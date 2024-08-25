import { Context, Layer, Effect } from "effect"
import type { Server } from "bun"

// Define Bun Server as a service
class BunServer extends Context.Tag("BunServer")<
  BunServer,
  Server
>() {}

// Define the main route, IndexRouteLive, as a Layer
const IndexRouteLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const server = yield* BunServer

    server.fetch = (req: Request | string) => {
      if (typeof req === 'string') return new Response("Invalid request", { status: 400 });
      
      if (req.method === "GET" && new URL(req.url).pathname === "/") {
        return Effect.runPromise(Effect.sync(() => new Response("Hello World!")))
      }
      if (req.method === "GET" && new URL(req.url).pathname === "/api") {
        return Effect.runPromise(Effect.sync(() => new Response("API")))
      }
      return new Response("Not Found", { status: 404 })
    }
  })
)

// Server Setup
const ServerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const port = 3001
    const bunServer = yield* BunServer
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const serverInstance = Bun.serve({
          port,
          fetch: bunServer.fetch
        });
        console.log(`Example app listening on port ${port}`);
        return serverInstance;
      }),
      (server) => Effect.sync(() => server.stop())
    )
  })
)

// Setting Up Bun Server
const BunServerLive = Layer.sync(BunServer, () => Bun.serve({
  fetch: () => new Response("Not Found", { status: 404 }),
}))

// Combine the layers
const AppLive = ServerLive.pipe(
  Layer.provide(IndexRouteLive),
  Layer.provide(BunServerLive)
)

// Run the program
Effect.runFork(Layer.launch(AppLive))