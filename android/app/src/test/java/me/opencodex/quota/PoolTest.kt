package me.opencodex.quota
import org.junit.Assert.*
import org.junit.Test
class PoolTest {
    @Test fun aggregationAndBlockedRecoveries() {
        val accounts=listOf(Account(50.0,20.0,1800.0,9000.0,null),Account(100.0,100.0,1200.0,9600.0,null))
        val pool=PoolMath.summarize(accounts,1000.0)
        assertEquals(25.0,pool.remaining!!,0.001)
        assertEquals(40.0,pool.week!!,0.001)
        assertEquals(1,pool.recoveries.size)
        assertEquals(25.0,pool.recoveries[0].gain,0.001)
        assertEquals(2,pool.weekly.size)
    }
    @Test fun missingUsageAndExpiredReset() {
        val pool=PoolMath.summarize(listOf(Account(null,20.0,null,900.0,null)),1000.0)
        assertNull(pool.remaining);assertTrue(pool.overdue);assertTrue(pool.weekly.isEmpty())
        assertEquals("4d 2h",PoolMath.duration(4*86400.0+7200))
        assertEquals("+3.4%p",PoolMath.gain(3.4))
    }
}
