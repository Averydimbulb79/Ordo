package sg.kithandkeen.ordo;

/** JSON numbers may arrive as Integer, Long or Double across the Capacitor bridge. */
final class SaveByteCount {
    static Long read(Object value) {
        if (!(value instanceof Number)) return null;
        double number = ((Number) value).doubleValue();
        if (Double.isNaN(number) || Double.isInfinite(number) || number < 0 || number > 268435456L || number != Math.rint(number)) return null;
        return ((Number) value).longValue();
    }
}
