import { router, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { exampleRouter } from './example.js'

const appRouter = router()
	.query('hello', {
		output: z.string(),
		resolve() {
			return 'world'
		},
	})
	.mutation('post.create', {
		input: z.object({ title: z.string() }),
		resolve: ({ input }) => {
			return {
				id: 1,
				title: input.title,
			}
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
