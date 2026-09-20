import { defineConfig, loadEnv } from "vite";
import { parseStory } from "./src/engine/story";

function typeSafeProxy(
  apiKey: string | undefined,
  nvidiaKey: string | undefined,
) {
  async function handle(req: any, res: any, next: () => void) {
    const path = req.url?.split("?")[0];
    const creative = path === "/api/creative-director";
    if (path !== "/api/system-one" && !creative) {
      next();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    if (!(creative ? nvidiaKey : apiKey)) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: creative
            ? "NVIDIA_API_KEY is not configured."
            : "TYPESAFE_API_KEY is not configured. Add it to .env.local to enable Jev.",
        }),
      );
      return;
    }

    try {
      let raw = "";

      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 65536) {
          res.statusCode = 413;
          res.end(JSON.stringify({ error: "Request too large" }));
          return;
        }
      }

      const payload = JSON.parse(raw);

      if (creative) {
        if (
          typeof payload.prompt !== "string" ||
          !payload.prompt.trim() ||
          payload.prompt.length > 600
        ) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: "Provide a story idea under 600 characters.",
            }),
          );
          return;
        }
        const result = await fetch(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          {
            method: "POST",
            signal: AbortSignal.timeout(22000),
            headers: {
              Authorization: `Bearer ${nvidiaKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/diffusiongemma-26b-a4b-it",
              stream: false,
              temperature: 0.8,
              max_tokens: 1200,
              chat_template_kwargs: { enable_thinking: false },
              messages: [
                {
                  role: "user",
                  content: `You are a creative director for a small adaptive dark ride. Compose a concise emotional arc inspired by this visitor idea: ${JSON.stringify(payload.prompt)}.
The physical scene is a moonlit mechanical garden: fountain (pulse/burst/dim), statue (turn-toward/turn-away/pose), flowers (bloom/fold/ripple), clockwork creature (hop/hide/circle), lantern (beckon/glimmer/bow), ride vehicle (approach/observe/orbit/linger/exit), lighting, sound and scenic machinery.
Return ONLY a JSON object with title (under 100 characters), intent (under 1000 characters), and beats {arrival, discovery, farewell, departure} (each under 600 characters). Write dramatic intentions, emotional stakes and invitations to interpret. Do not prescribe routes, map personalities to actors, invent capabilities, change the number of beats, or output code. The scene must remain suitable for all ages. The runtime and Jev will choose the actual performances.`,
                },
              ],
            }),
          },
        );
        if (!result.ok) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "Creative provider unavailable" }));
          return;
        }
        const response = (await result.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = response.choices?.[0]?.message?.content ?? "";
        const story = parseStory(
          JSON.parse(
            content
              .replace(/^\s*```(?:json)?\s*/, "")
              .replace(/\s*```\s*$/, ""),
          ),
        );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(story));
        return;
      }

      const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        signal: AbortSignal.timeout(3200),
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
          error: "The provider could not complete this request.",
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
    plugins: [typeSafeProxy(env.TYPESAFE_API_KEY, env.NVIDIA_API_KEY)],
  };
});
