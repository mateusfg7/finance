/** biome-ignore-all lint/suspicious/noConsole: Initial tests */

import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import z from "zod";

const app = Fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

app.get("/health", (_request, _reply) => {
  return "ok";
});

app.post(
  "/accounts",
  {
    schema: {
      body: z.object({
        name: z.string().min(1),
      }),
    },
  },
  (request, reply) => {
    const { name } = request.body;
    reply.code(HttpStatus.CREATED).send({ id: 1, name });
  }
);

app.listen({ port: 3000 }, (err, addr) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${addr}`);
});
