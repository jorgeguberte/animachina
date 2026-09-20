import { defineConfig, loadEnv } from "vite";

function typeSafeProxy(apiKey: string | undefined) {
  async function handle(req: any, res: any, next: () => void) {
    if (!req.url?.startsWith("/api/system-one")) {
      next();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error:
            "TYPESAFE_API_KEY is not configured. Add it to .env.local to enable Jev.",
        }),
      );
      return;
    }

    try {
      let raw = "";

      for await (const chunk of req) {
        raw += chunk;
      }

      const payload = JSON.parse(raw);

      const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await upstream.text();

      res.statusCode = upstream.status;
      res.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/json",
      );
      res.end(body);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return {
    name: "animachina-typesafe-proxy",
    configureServer(server: any) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handle);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [typeSafeProxy(env.TYPESAFE_API_KEY)],
  };
});
