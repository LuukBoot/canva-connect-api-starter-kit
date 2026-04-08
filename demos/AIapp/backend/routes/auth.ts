import type { CookieOptions } from "express";
import crypto from "node:crypto";
import express from "express";
import {
  AUTH_COOKIE_NAME,
  OAUTH_CODE_VERIFIER_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  getAuthorizationUrl,
} from "../../../common/backend/services/auth";
import * as jose from "jose";
import {
  deleteToken,
  getToken,
  setToken,
} from "../../../common/backend/database/queries";
import {
  getAccessTokenForUser,
  getBasicAuthClient,
} from "../../../common/backend/services/client";
import type {
  ExchangeAccessTokenRequest,
  RevokeTokensRequest,
} from "@canva/connect-api-ts";
import { OauthService } from "@canva/connect-api-ts";
import { db } from "../database/database";

const globals: {
  redirectUri: string;
} = {
  redirectUri: "",
};

const router = express.Router();

const endpoints = {
  REDIRECT: "/oauth/redirect",
  SUCCESS: "/success",
  FAILURE: "/failure",
  AUTHORIZE: "/authorize",
  IS_AUTHORIZED: "/isauthorized",
  REVOKE: "/revoke",
};

globals.redirectUri = new URL(
  endpoints.REDIRECT,
  process.env.BACKEND_URL,
).toString();

router.get(endpoints.REDIRECT, async (req, res) => {
  const authorizationCode = req.query.code;
  const state = req.query.state;
  if (typeof authorizationCode !== "string" || typeof state !== "string") {
    const params = new URLSearchParams({
      error:
        typeof req.query.error === "string" ? req.query.error : "Unknown error",
    });
    return res.redirect(`${endpoints.FAILURE}?${params.toString()}`);
  }

  try {
    if (state !== req.signedCookies[OAUTH_STATE_COOKIE_NAME]) {
      throw new Error(
        `Invalid state ${state} != ${req.signedCookies[OAUTH_STATE_COOKIE_NAME]}`,
      );
    }

    const codeVerifier = req.signedCookies[OAUTH_CODE_VERIFIER_COOKIE_NAME];

    const params: ExchangeAccessTokenRequest = {
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
      code: authorizationCode,
      redirect_uri: globals.redirectUri,
    };

    const result = await OauthService.exchangeAccessToken({
      client: getBasicAuthClient(),
      body: params,
    });

    if (result.error) {
      console.error(result.error);
      return res.status(result.response.status).json(result.error);
    }

    const token = result.data;
    if (!token) {
      throw new Error(
        "No token returned when exchanging oauth code for token, but no error was returned either.",
      );
    }

    const claims = jose.decodeJwt(token.access_token);
    const claimsSub = claims.sub;
    if (!claimsSub) {
      throw new Error("Unable to extract claims sub from access token.");
    }

    res.cookie(AUTH_COOKIE_NAME, claimsSub, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      secure: process.env.NODE_ENV === "production",
      signed: true,
    });
    await setToken(token, claimsSub, db);

    return res.redirect(endpoints.SUCCESS);
  } catch (error) {
    console.error(error);
    const url = new URL(endpoints.FAILURE, process.env.BACKEND_URL);
    if (error instanceof Error) {
      url.searchParams.append("error", error.message || error.toString());
    }
    return res.redirect(url.toString());
  }
});

router.get(endpoints.SUCCESS, async (req, res) => {
  res.render("auth_success", {
    countdownSecs: 2,
    message: "authorization_success",
  });
});

router.get(endpoints.FAILURE, async (req, res) => {
  res.render("auth_failure", {
    countdownSecs: 10,
    message: "authorization_error",
    errorMessage: req.query.error || "Unknown error",
  });
});

router.get(endpoints.AUTHORIZE, async (req, res) => {
  const codeVerifier = crypto.randomBytes(96).toString("base64url");
  const state = crypto.randomBytes(96).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest()
    .toString("base64url");

  const url = getAuthorizationUrl(globals.redirectUri, state, codeChallenge);
  const cookieConfiguration: CookieOptions = {
    httpOnly: true,
    maxAge: 1000 * 60 * 20, // 20 minutes
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: true,
  };
  return res
    .cookie(OAUTH_STATE_COOKIE_NAME, state, cookieConfiguration)
    .cookie(OAUTH_CODE_VERIFIER_COOKIE_NAME, codeVerifier, cookieConfiguration)
    .redirect(url);
});

router.get(endpoints.REVOKE, async (req, res) => {
  const user = req.signedCookies[AUTH_COOKIE_NAME];
  const token = await getToken(user, db);

  res.clearCookie(AUTH_COOKIE_NAME);
  if (!token) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const client_id = process.env.CANVA_CLIENT_ID;
    if (!client_id) {
      throw new Error("'CANVA_CLIENT_ID' env variable is undefined");
    }

    const client_secret = process.env.CANVA_CLIENT_SECRET;
    if (!client_secret) {
      throw new Error("'CANVA_CLIENT_SECRET' env variable is undefined");
    }

    const params: RevokeTokensRequest = {
      client_secret,
      client_id,
      token: token.refresh_token,
    };

    await OauthService.revokeTokens({
      client: getBasicAuthClient(),
      body: params,
    });
  } catch (e) {
    console.log(e);
    return res.sendStatus(401);
  } finally {
    await deleteToken(user, db);
  }
  return res.sendStatus(200);
});

router.get(endpoints.IS_AUTHORIZED, async (req, res) => {
  const auth = req.signedCookies[AUTH_COOKIE_NAME];
  try {
    await getAccessTokenForUser(auth, db);
    return res.json({ status: true });
  } catch {
    return res.sendStatus(404);
  }
});

export default router;
