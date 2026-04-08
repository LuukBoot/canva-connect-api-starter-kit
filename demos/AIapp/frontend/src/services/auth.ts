const endpoints = {
  AUTHORIZE: "/authorize",
  REVOKE: "/revoke",
  TOKEN: "/token",
  IS_AUTHORIZED: "/isauthorized",
};

export const getCanvaAuthorization = async (): Promise<string | undefined> => {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(endpoints.AUTHORIZE, process.env.BACKEND_URL);
      const windowFeatures = ["popup", "height=800", "width=800"];
      const authWindow = window.open(url.toString(), "", windowFeatures.join(","));

      const checkAuth = async () => {
        try {
          const { token } = await checkForAccessToken();
          resolve(token);
        } catch (error) {
          reject(error);
        }
      };

      window.addEventListener("message", (event) => {
        if (event.data === "authorization_success") {
          checkAuth();
          authWindow?.close();
        } else if (event.data === "authorization_error") {
          reject(new Error("Authorization failed"));
          authWindow?.close();
        }
      });

      const checkWindowClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkWindowClosed);
          checkAuth();
        }
      }, 1000);
    } catch (error) {
      console.error("Authorization failed", error);
      reject(error);
    }
  });
};

export const revokeAuthorization = async (): Promise<boolean> => {
  const url = new URL(endpoints.REVOKE, process.env.BACKEND_URL);
  const response = await fetch(url.toString(), { credentials: "include" });
  return response.ok;
};

export const checkForAccessToken = async (): Promise<{
  token?: string;
}> => {
  const url = new URL(endpoints.TOKEN, process.env.BACKEND_URL);
  const response = await fetch(url.toString(), { credentials: "include" });
  if (!response.ok) {
    return { token: undefined };
  }
  return { token: await response.text() };
};

export const isAuthorized = async (): Promise<boolean> => {
  const url = new URL(endpoints.IS_AUTHORIZED, process.env.BACKEND_URL);
  const response = await fetch(url.toString(), { credentials: "include" });
  return response.ok;
};
