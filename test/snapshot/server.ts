import { router, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { exampleRouter } from './server2.js'

const appRouter = router()
	.query('hello', {
		output: z.string(),
		resolve() {
			return 'world'
		},
	})
	.query('post', {
		resolve() {
			return 'post'
		},
	})
	.mutation('post.create', {
		input: z.object({ title: z.string() }),
		async resolve({ input }) {
			return {
				id: 1,
				title: input.title,
			}
		},
	})
	.query('post.byId', {
		input: z.object({ id: z.string() }),
		resolve: ({ input }) => {
			return {
				id: input.id,
				title: 'hello',
			}
		},
	})
	.query('post.get-title', {
		input: z.object({ title: z.string() }),
		resolve: ({ input }) => {
			return input.title
		},
	})
	.merge('example', exampleRouter)
	.middleware(async ({ ctx, next }) => {
		if (!ctx.user?.isAdmin) {
			throw new TRPCError({ code: 'UNAUTHORIZED' })
		}
		return next()
	})
	.query('secretPlace', {
		resolve() {
			return 'a key'
		},
	})

const caller = appRouter.createCaller({})
await caller.query('post.byId', { id: '1923071203' })
