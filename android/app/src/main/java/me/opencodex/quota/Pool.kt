package me.opencodex.quota

import kotlin.math.ceil
import kotlin.math.roundToInt
import java.util.Locale

data class Account(val short: Double?, val week: Double?, val shortReset: Double?, val weekReset: Double?, val updated: Double?, val paused: Boolean = false, val reauth: Boolean = false)
data class Recovery(val at: Double, val gain: Double)
data class Pool(val remaining: Double?, val week: Double?, val recoveries: List<Recovery>, val weekly: List<Recovery>, val updated: Double?, val overdue: Boolean)
object PoolMath {
    fun summarize(accounts: List<Account>, now: Double): Pool {
        fun average(get: (Account) -> Double?): Double? = if (accounts.isNotEmpty() && accounts.all { get(it)?.isFinite() == true }) accounts.sumOf { 100 - get(it)!!.coerceIn(0.0,100.0) } / accounts.size else null
        var overdue = false
        fun recover(weekly: Boolean): List<Recovery> {
            val groups = sortedMapOf<Double, Double>()
            for (a in accounts) {
                val used = (if (weekly) a.week else a.short)?.takeIf { it.isFinite() }?.coerceIn(0.0,100.0) ?: continue
                val at = (if (weekly) a.weekReset else a.shortReset)?.takeIf { it.isFinite() } ?: continue
                if (used == 0.0) continue
                if (at <= now) { overdue = true; continue }
                if (!weekly && (a.paused || a.reauth || (a.week ?: 0.0) >= 100)) continue
                val minute = ceil(at / 60) * 60
                groups[minute] = (groups[minute] ?: 0.0) + used / accounts.size
            }
            return groups.map { Recovery(it.key, it.value) }
        }
        val short = recover(false); val weekly = recover(true)
        return Pool(average { it.short }, average { it.week }, short, weekly, accounts.mapNotNull { it.updated }.minOrNull(), overdue)
    }
    fun duration(seconds: Double): String {
        val minutes = ceil(seconds / 60).toInt().coerceAtLeast(1)
        return when {
            minutes >= 1440 -> "${minutes / 1440}d" + if (minutes % 1440 / 60 > 0) " ${minutes % 1440 / 60}h" else ""
            minutes >= 60 -> "${minutes / 60}h" + if (minutes % 60 > 0) " ${minutes % 60}m" else ""
            else -> "${minutes}m"
        }
    }
    fun gain(value: Double): String { val n = (value * 10).roundToInt() / 10.0; return "+" + (if (n % 1 == 0.0) n.toInt().toString() else String.format(Locale.US,"%.1f",n)) + "%p" }
}
