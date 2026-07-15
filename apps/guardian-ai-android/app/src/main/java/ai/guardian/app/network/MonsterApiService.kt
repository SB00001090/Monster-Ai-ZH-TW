package ai.guardian.app.network

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/** Guardian Ai API — Cloudflare Tunnel HTTPS only. Developed by Suckbob | Guardian Ai */
interface MonsterApiService {
    @GET("health")
    suspend fun health(): Response<ResponseBody>

    @GET("api/guardian/status")
    suspend fun guardianStatus(): Response<ResponseBody>

    @GET("api/guardian/connection")
    suspend fun connection(): Response<ResponseBody>

    @GET("api/guardian/disclaimer")
    suspend fun disclaimer(@Query("locale") locale: String = "zh-TW"): Response<ResponseBody>
}