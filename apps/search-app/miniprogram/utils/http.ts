import { createHttpClient } from '@dim-sum/http'
import { API } from '../config/api'
import { auth, promptLogin } from './auth'

export const { request } = createHttpClient({
  baseUrl: API.baseUrl,
  auth,
  onAuthRequired: () => promptLogin(),
})
export default request
