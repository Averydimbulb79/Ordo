package sg.kithandkeen.ordo;

import org.junit.Test;
import static org.junit.Assert.*;

public class SaveByteCountTest {
    @Test public void acceptsJsonIntegerSizesAndChunkOffsets() {
        assertEquals(Long.valueOf(1048576), SaveByteCount.read(Integer.valueOf(1048576)));
        assertEquals(Long.valueOf(0), SaveByteCount.read(Integer.valueOf(0)));
        assertEquals(Long.valueOf(262144), SaveByteCount.read(Integer.valueOf(262144)));
    }

    @Test public void acceptsOtherWholeJsonNumbersAndLimitBoundary() {
        assertEquals(Long.valueOf(1048576), SaveByteCount.read(Long.valueOf(1048576)));
        assertEquals(Long.valueOf(1048576), SaveByteCount.read(Double.valueOf(1048576)));
        assertEquals(Long.valueOf(268435456), SaveByteCount.read(Integer.valueOf(268435456)));
    }

    @Test public void rejectsInvalidAndOversizedCounts() {
        for (Object value : new Object[]{null, "1024", true, -1, 0.5, 268435457L, Long.MAX_VALUE, Double.NaN, Double.POSITIVE_INFINITY}) {
            assertNull("Rejected: " + value, SaveByteCount.read(value));
        }
    }
}
