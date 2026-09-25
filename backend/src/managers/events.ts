import { Socket } from "socket.io";
import { z } from "zod";

// Payload schemas for every client → server socket event. Anything that
// doesn't parse is dropped, so a malformed (or null) payload can't throw
// inside a handler and take the process down.

const MAX_CHAT_LENGTH = 500;
const MAX_NAME_LENGTH = 40;

const roomId = z.string().uuid();

const sessionDescription = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().max(100_000),
});

export const socketEvents = {
  // Accepts a bare name or { name }; anything else joins as "Guest".
  ready: z
    .union([z.string(), z.object({ name: z.string() })])
    .transform((p) => (typeof p === "string" ? p : p.name).trim().slice(0, MAX_NAME_LENGTH))
    .catch("")
    .transform((name) => name || "Guest"),
  offer: z.object({ roomId, sdp: sessionDescription }),
  answer: z.object({ roomId, sdp: sessionDescription }),
  "add-ice-candidate": z.object({
    roomId,
    candidate: z.object({
      candidate: z.string().max(2_000),
      sdpMid: z.string().max(64).nullish(),
      sdpMLineIndex: z.number().int().min(0).nullish(),
      usernameFragment: z.string().max(256).nullish(),
    }),
  }),
  "media-state": z.object({ roomId, audio: z.boolean(), video: z.boolean() }),
  "chat-message": z.object({
    roomId,
    // Long messages are truncated rather than rejected.
    text: z.string().transform((t) => t.trim().slice(0, MAX_CHAT_LENGTH)).pipe(z.string().min(1)),
  }),
  typing: z.object({ roomId, typing: z.boolean() }),
  next: z.unknown(),
  leave: z.unknown(),
} satisfies Record<string, z.ZodType>;

export type SocketEvent = keyof typeof socketEvents;

/** socket.on() that only calls `handler` with a payload that passed its schema. */
export function onEvent<E extends SocketEvent>(
  socket: Socket,
  event: E,
  handler: (payload: z.output<(typeof socketEvents)[E]>) => void,
) {
  socket.on(event as string, (raw: unknown) => {
    const parsed = socketEvents[event].safeParse(raw);
    if (parsed.success) handler(parsed.data as z.output<(typeof socketEvents)[E]>);
  });
}
