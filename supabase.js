// Configuração pública do Supabase da Modulix.
// NUNCA coloque service_role, senhas ou credenciais privilegiadas aqui.

const MODULIX_SUPABASE_URL =
  "https://xxzlnchirsvgkgrkazpp.supabase.co";

const MODULIX_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_y0avA1hiYHtbJP10ZHrMYQ_2XhMnOKq";

// Compatibilidade com o Studio
window.MODULIX_SUPABASE_URL =
  MODULIX_SUPABASE_URL;

window.MODULIX_SUPABASE_PUBLISHABLE_KEY =
  MODULIX_SUPABASE_PUBLISHABLE_KEY;


// Evita carregamento infinito quando o Supabase não responde.
(() => {
  const supabaseGlobal = window.supabase;

  if (
    !supabaseGlobal ||
    typeof supabaseGlobal.createClient !== "function"
  ) {
    console.error(
      "Modulix Studio: biblioteca Supabase não carregou."
    );
    return;
  }

  const originalCreateClient =
    supabaseGlobal.createClient.bind(supabaseGlobal);

  const AUTH_TIMEOUT_MS = 12000;

  function withTimeout(promise, operation) {
    let timer;

    const timeout = new Promise((resolve) => {
      timer = window.setTimeout(() => {
        resolve({
          data:
            operation === "getSession"
              ? { session: null }
              : {
                  user: null,
                  session: null
                },
          error: new Error(
            "O Supabase demorou para responder. Verifique sua conexão e tente novamente."
          )
        });
      }, AUTH_TIMEOUT_MS);
    });

    return Promise.race([
      promise,
      timeout
    ]).finally(() => {
      window.clearTimeout(timer);
    });
  }

  supabaseGlobal.createClient = (...args) => {
    const client =
      originalCreateClient(...args);

    const originalGetSession =
      client.auth.getSession.bind(
        client.auth
      );

    const originalSignIn =
      client.auth.signInWithPassword.bind(
        client.auth
      );

    client.auth.getSession = () =>
      withTimeout(
        originalGetSession(),
        "getSession"
      );

    client.auth.signInWithPassword =
      (credentials) =>
        withTimeout(
          originalSignIn(credentials),
          "signInWithPassword"
        );

    return client;
  };
})();
