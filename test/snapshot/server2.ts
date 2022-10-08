import { router } from '@trpc/server'
const createProtectedRouter = router

export const exampleRouter = createProtectedRouter()
	.query('thing', {
		resolve() {
			return 'example'
		},
	})
