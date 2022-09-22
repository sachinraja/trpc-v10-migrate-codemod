import { router } from '@trpc/server'

export const exampleRouter = router().query('thing', {
	resolve() {
		return 'example'
	},
})
