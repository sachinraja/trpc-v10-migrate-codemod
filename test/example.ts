import { router } from '@trpc/server'

export const exampleRouter = t.router({
	thing: t.procedure.query(() => {
		return 'example'
	}),
})
