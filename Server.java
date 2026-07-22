import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Server {
    private static final int PORT = 3000;
    private static final String SECRET_KEY = "sportzone_super_secret_key_12345";
    private static final String DB_FILE = "data/db.json";

    // In-memory Database state
    private static final List<Map<String, String>> users = new ArrayList<>();
    private static final List<Map<String, String>> bookings = new ArrayList<>();
    private static final Map<String, Integer> utilization = new HashMap<>();
    private static final Object dbLock = new Object();

    public static void main(String[] args) throws Exception {
        loadDatabase();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        // Router / Handlers
        server.createContext("/", new RouteHandler());
        
        server.setExecutor(null); // default executor
        System.out.println("SportZone Java Server is running on http://localhost:" + PORT);
        server.start();
    }

    // Load database on startup
    private static void loadDatabase() {
        synchronized (dbLock) {
            users.clear();
            bookings.clear();
            utilization.clear();
            
            // Default stats values
            utilization.put("Football Turf", 92);
            utilization.put("Basketball", 78);
            utilization.put("Tennis", 65);
            utilization.put("Badminton", 85);
            utilization.put("Cricket", 54);

            File file = new File(DB_FILE);
            if (!file.exists()) {
                // Pre-seed demo database
                Map<String, String> demoUser = new HashMap<>();
                demoUser.put("id", "1");
                demoUser.put("email", "demo@sportzone.com");
                demoUser.put("password", "password123");
                demoUser.put("name", "Demo Admin");
                users.add(demoUser);

                seedDefaultBookings();
                saveDatabase();
                return;
            }

            try {
                String content = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
                
                // Parse Users using regex
                Pattern userPattern = Pattern.compile("\\{\\s*\"id\"\\s*:\\s*(\\d+)\\s*,\\s*\"email\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"password\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"name\"\\s*:\\s*\"([^\"]+)\"\\s*\\}");
                Matcher userMatcher = userPattern.matcher(content);
                while (userMatcher.find()) {
                    Map<String, String> u = new HashMap<>();
                    u.put("id", userMatcher.group(1));
                    u.put("email", userMatcher.group(2));
                    u.put("password", userMatcher.group(3));
                    u.put("name", userMatcher.group(4));
                    users.add(u);
                }

                // Parse Bookings using regex
                Pattern bookingPattern = Pattern.compile("\\{\\s*\"id\"\\s*:\\s*(\\d+)\\s*,\\s*\"time\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"venue\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"team\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"status\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"date\"\\s*:\\s*\"([^\"]+)\"\\s*\\}");
                Matcher bookingMatcher = bookingPattern.matcher(content);
                while (bookingMatcher.find()) {
                    Map<String, String> b = new HashMap<>();
                    b.put("id", bookingMatcher.group(1));
                    b.put("time", bookingMatcher.group(2));
                    b.put("venue", bookingMatcher.group(3));
                    b.put("team", bookingMatcher.group(4));
                    b.put("status", bookingMatcher.group(5));
                    b.put("date", bookingMatcher.group(6));
                    bookings.add(b);
                }

                // Parse Utilization
                Pattern utilPattern = Pattern.compile("\"([^\"]+)\"\\s*:\\s*(\\d+)");
                Matcher utilMatcher = utilPattern.matcher(content);
                while (utilMatcher.find()) {
                    String key = utilMatcher.group(1);
                    if (utilization.containsKey(key)) {
                        utilization.put(key, Integer.parseInt(utilMatcher.group(2)));
                    }
                }
            } catch (Exception e) {
                System.err.println("Error parsing db.json, seeding defaults: " + e.getMessage());
                seedDefaultBookings();
            }
        }
    }

    private static void seedDefaultBookings() {
        String[][] seedBookings = {
            {"1", "10:00", "Arena 7 Football", "Team Eagles", "Confirmed", "2026-06-15"},
            {"2", "12:00", "Skyline Basketball", "Marcus J.", "Confirmed", "2026-06-15"},
            {"3", "14:00", "Center Court Tennis", "Anna K.", "Pending", "2026-06-15"},
            {"4", "16:00", "SmashHouse Badminton", "Dev R.", "Confirmed", "2026-06-15"},
            {"5", "18:00", "Pulse Cricket Ground", "Royals XI", "Confirmed", "2026-06-15"}
        };
        for (String[] sb : seedBookings) {
            Map<String, String> b = new HashMap<>();
            b.put("id", sb[0]);
            b.put("time", sb[1]);
            b.put("venue", sb[2]);
            b.put("team", sb[3]);
            b.put("status", sb[4]);
            b.put("date", sb[5]);
            bookings.add(b);
        }
    }

    // Save database to file
    private static void saveDatabase() {
        synchronized (dbLock) {
            File file = new File(DB_FILE);
            file.getParentFile().mkdirs();

            StringBuilder sb = new StringBuilder();
            sb.append("{\n  \"users\": [\n");
            for (int i = 0; i < users.size(); i++) {
                Map<String, String> u = users.get(i);
                sb.append(String.format("    {\n      \"id\": %s,\n      \"email\": \"%s\",\n      \"password\": \"%s\",\n      \"name\": \"%s\"\n    }%s\n",
                        u.get("id"), u.get("email"), u.get("password"), u.get("name"), (i < users.size() - 1 ? "," : "")));
            }
            sb.append("  ],\n  \"bookings\": [\n");
            for (int i = 0; i < bookings.size(); i++) {
                Map<String, String> b = bookings.get(i);
                sb.append(String.format("    {\n      \"id\": %s,\n      \"time\": \"%s\",\n      \"venue\": \"%s\",\n      \"team\": \"%s\",\n      \"status\": \"%s\",\n      \"date\": \"%s\"\n    }%s\n",
                        b.get("id"), b.get("time"), b.get("venue"), b.get("team"), b.get("status"), b.get("date"), (i < bookings.size() - 1 ? "," : "")));
            }
            sb.append("  ],\n  \"utilization\": {\n");
            int j = 0;
            for (Map.Entry<String, Integer> entry : utilization.entrySet()) {
                sb.append(String.format("    \"%s\": %d%s\n", entry.getKey(), entry.getValue(), (j < utilization.size() - 1 ? "," : "")));
                j++;
            }
            sb.append("  }\n}");

            try (FileWriter writer = new FileWriter(file)) {
                writer.write(sb.toString());
            } catch (IOException e) {
                System.err.println("Error saving database: " + e.getMessage());
            }
        }
    }

    // Unified Route Handler
    static class RouteHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();

            // Set CORS headers
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization");

            if ("OPTIONS".equals(method)) {
                exchange.sendResponseHeaders(200, -1);
                return;
            }

            // Route matching
            if (path.startsWith("/api/")) {
                handleAPI(exchange, method, path);
            } else {
                handleStatic(exchange, path);
            }
        }

        private void handleStatic(HttpExchange exchange, String path) throws IOException {
            if ("/".equals(path)) path = "/index.html";
            else if ("/compare".equals(path)) path = "/compare.html";
            else if ("/dashboard".equals(path)) path = "/dashboard.html";
            else if ("/auth".equals(path)) path = "/auth.html";

            File file = new File("public" + path);
            if (!file.exists() || file.isDirectory()) {
                String response = "404 Not Found";
                exchange.sendResponseHeaders(404, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
                return;
            }

            String contentType = "text/plain";
            if (path.endsWith(".html")) contentType = "text/html";
            else if (path.endsWith(".css")) contentType = "text/css";
            else if (path.endsWith(".js")) contentType = "application/javascript";
            else if (path.endsWith(".svg")) contentType = "image/svg+xml";

            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, file.length());

            OutputStream os = exchange.getResponseBody();
            Files.copy(file.toPath(), os);
            os.close();
        }

        private void handleAPI(HttpExchange exchange, String method, String path) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json");

            try {
                if ("/api/auth/register".equals(path) && "POST".equals(method)) {
                    handleRegister(exchange);
                } else if ("/api/auth/login".equals(path) && "POST".equals(method)) {
                    handleLogin(exchange);
                } else if ("/api/auth/me".equals(path) && "GET".equals(method)) {
                    handleMe(exchange);
                } else if ("/api/bookings".equals(path)) {
                    if ("GET".equals(method)) handleGetBookings(exchange);
                    else if ("POST".equals(method)) handleCreateBooking(exchange);
                } else if ("/api/dashboard/stats".equals(path) && "GET".equals(method)) {
                    handleStats(exchange);
                } else {
                    sendJSON(exchange, 404, "{\"error\":\"Not Found\"}");
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendJSON(exchange, 500, "{\"error\":\"" + e.getMessage() + "\"}");
            }
        }

        // POST /api/auth/register
        private void handleRegister(HttpExchange exchange) throws Exception {
            String body = readRequestBody(exchange);
            String email = getJSONStringField(body, "email");
            String password = getJSONStringField(body, "password");
            String name = getJSONStringField(body, "name");

            if (email == null || password == null || name == null) {
                sendJSON(exchange, 400, "{\"error\":\"Email, password, and name are required\"}");
                return;
            }

            synchronized (dbLock) {
                for (Map<String, String> u : users) {
                    if (u.get("email").equalsIgnoreCase(email)) {
                        sendJSON(exchange, 400, "{\"error\":\"User already exists with this email\"}");
                        return;
                    }
                }

                int maxId = 0;
                for (Map<String, String> u : users) {
                    maxId = Math.max(maxId, Integer.parseInt(u.get("id")));
                }

                Map<String, String> newUser = new HashMap<>();
                newUser.put("id", String.valueOf(maxId + 1));
                newUser.put("email", email.toLowerCase());
                newUser.put("password", password);
                newUser.put("name", name);
                users.add(newUser);
                saveDatabase();

                String token = generateToken(newUser.get("id"), newUser.get("email"), newUser.get("name"));
                String response = String.format("{\"token\":\"%s\",\"user\":{\"id\":%s,\"email\":\"%s\",\"name\":\"%s\"}}",
                        token, newUser.get("id"), newUser.get("email"), newUser.get("name"));
                sendJSON(exchange, 201, response);
            }
        }

        // POST /api/auth/login
        private void handleLogin(HttpExchange exchange) throws Exception {
            String body = readRequestBody(exchange);
            String email = getJSONStringField(body, "email");
            String password = getJSONStringField(body, "password");

            if (email == null || password == null) {
                sendJSON(exchange, 400, "{\"error\":\"Email and password are required\"}");
                return;
            }

            synchronized (dbLock) {
                Map<String, String> foundUser = null;
                for (Map<String, String> u : users) {
                    if (u.get("email").equalsIgnoreCase(email) && u.get("password").equals(password)) {
                        foundUser = u;
                        break;
                    }
                }

                if (foundUser == null) {
                    sendJSON(exchange, 401, "{\"error\":\"Invalid email or password\"}");
                    return;
                }

                String token = generateToken(foundUser.get("id"), foundUser.get("email"), foundUser.get("name"));
                String response = String.format("{\"token\":\"%s\",\"user\":{\"id\":%s,\"email\":\"%s\",\"name\":\"%s\"}}",
                        token, foundUser.get("id"), foundUser.get("email"), foundUser.get("name"));
                sendJSON(exchange, 200, response);
            }
        }

        // GET /api/auth/me
        private void handleMe(HttpExchange exchange) throws Exception {
            Map<String, String> payload = authenticateUser(exchange);
            if (payload == null) {
                sendJSON(exchange, 401, "{\"error\":\"Unauthorized\"}");
                return;
            }

            String response = String.format("{\"user\":{\"id\":%s,\"email\":\"%s\",\"name\":\"%s\"}}",
                    payload.get("id"), payload.get("email"), payload.get("name"));
            sendJSON(exchange, 200, response);
        }

        // GET /api/bookings
        private void handleGetBookings(HttpExchange exchange) throws Exception {
            StringBuilder sb = new StringBuilder();
            sb.append("[");
            synchronized (dbLock) {
                for (int i = 0; i < bookings.size(); i++) {
                    Map<String, String> b = bookings.get(i);
                    sb.append(String.format("{\"id\":%s,\"time\":\"%s\",\"venue\":\"%s\",\"team\":\"%s\",\"status\":\"%s\",\"date\":\"%s\"}%s",
                            b.get("id"), b.get("time"), b.get("venue"), b.get("team"), b.get("status"), b.get("date"), (i < bookings.size() - 1 ? "," : "")));
                }
            }
            sb.append("]");
            sendJSON(exchange, 200, sb.toString());
        }

        // POST /api/bookings
        private void handleCreateBooking(HttpExchange exchange) throws Exception {
            Map<String, String> payload = authenticateUser(exchange);
            if (payload == null) {
                sendJSON(exchange, 401, "{\"error\":\"Unauthorized\"}");
                return;
            }

            String body = readRequestBody(exchange);
            String time = getJSONStringField(body, "time");
            String venue = getJSONStringField(body, "venue");
            String team = getJSONStringField(body, "team");

            if (time == null || venue == null || team == null) {
                sendJSON(exchange, 400, "{\"error\":\"Time, venue, and team/name are required\"}");
                return;
            }

            synchronized (dbLock) {
                int maxId = 0;
                for (Map<String, String> b : bookings) {
                    maxId = Math.max(maxId, Integer.parseInt(b.get("id")));
                }

                Map<String, String> newBooking = new HashMap<>();
                newBooking.put("id", String.valueOf(maxId + 1));
                newBooking.put("time", time);
                newBooking.put("venue", venue);
                newBooking.put("team", team);
                newBooking.put("status", "Confirmed");
                newBooking.put("date", "2026-06-15");
                bookings.add(newBooking);

                // Update utilization
                String category = "";
                String venueLower = venue.toLowerCase();
                if (venueLower.contains("football")) category = "Football Turf";
                else if (venueLower.contains("basketball")) category = "Basketball";
                else if (venueLower.contains("tennis")) category = "Tennis";
                else if (venueLower.contains("badminton")) category = "Badminton";
                else if (venueLower.contains("cricket")) category = "Cricket";

                if (!category.isEmpty() && utilization.containsKey(category)) {
                    utilization.put(category, Math.min(utilization.get(category) + 3, 100));
                }

                saveDatabase();

                String response = String.format("{\"id\":%s,\"time\":\"%s\",\"venue\":\"%s\",\"team\":\"%s\",\"status\":\"%s\",\"date\":\"%s\"}",
                        newBooking.get("id"), newBooking.get("time"), newBooking.get("venue"), newBooking.get("team"), newBooking.get("status"), newBooking.get("date"));
                sendJSON(exchange, 201, response);
            }
        }

        // GET /api/dashboard/stats
        private void handleStats(HttpExchange exchange) throws Exception {
            int bookingsCount = 0;
            synchronized (dbLock) {
                for (Map<String, String> b : bookings) {
                    if ("2026-06-15".equals(b.get("date"))) {
                        bookingsCount++;
                    }
                }
                double revenue = 24.6 + (bookings.size() * 0.05);
                int activePlayers = 1280 + bookings.size();

                StringBuilder sb = new StringBuilder();
                sb.append(String.format("{\"bookingsToday\":%d,\"activeTournaments\":6,\"activePlayers\":%d,\"revenueMonthly\":\"$%.1fk\",\"utilization\":{",
                        bookingsCount, activePlayers, revenue));
                int idx = 0;
                for (Map.Entry<String, Integer> entry : utilization.entrySet()) {
                    sb.append(String.format("\"%s\":%d%s", entry.getKey(), entry.getValue(), (idx < utilization.size() - 1 ? "," : "")));
                    idx++;
                }
                sb.append("}}");
                sendJSON(exchange, 200, sb.toString());
            }
        }

        // Authentication helper
        private Map<String, String> authenticateUser(HttpExchange exchange) {
            String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return null;
            }
            String token = authHeader.substring(7);
            try {
                return validateToken(token);
            } catch (Exception e) {
                return null;
            }
        }
    }

    // JWT / Token Generation (Plain Standard HS256 JWT implementation in Java)
    private static String generateToken(String userId, String email, String name) throws Exception {
        String header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
        String payload = String.format("{\"id\":%s,\"email\":\"%s\",\"name\":\"%s\",\"exp\":%d}",
                userId, email, name, (System.currentTimeMillis() / 1000) + 86400);

        String headerB64 = base64UrlEncode(header.getBytes(StandardCharsets.UTF_8));
        String payloadB64 = base64UrlEncode(payload.getBytes(StandardCharsets.UTF_8));

        String input = headerB64 + "." + payloadB64;
        String signature = hmacSha256(input, SECRET_KEY);

        return input + "." + signature;
    }

    private static Map<String, String> validateToken(String token) throws Exception {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new Exception("Invalid token format");
        }

        String input = parts[0] + "." + parts[1];
        String expectedSig = hmacSha256(input, SECRET_KEY);

        if (!MessageDigest.isEqual(base64UrlDecode(parts[2]), base64UrlDecode(expectedSig))) {
            throw new Exception("Invalid signature");
        }

        String payloadJson = new String(base64UrlDecode(parts[1]), StandardCharsets.UTF_8);
        Map<String, String> map = new HashMap<>();
        map.put("id", getJSONStringField(payloadJson, "id"));
        map.put("email", getJSONStringField(payloadJson, "email"));
        map.put("name", getJSONStringField(payloadJson, "name"));
        
        long exp = Long.parseLong(getJSONStringField(payloadJson, "exp"));
        if (System.currentTimeMillis() / 1000 > exp) {
            throw new Exception("Token expired");
        }

        return map;
    }

    // Helper functions for Cryptography
    private static String hmacSha256(String data, String key) throws Exception {
        SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(secretKey);
        byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return base64UrlEncode(hmacBytes);
    }

    private static String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] base64UrlDecode(String str) {
        return Base64.getUrlDecoder().decode(str);
    }

    // Helper JSON Parser (Self-contained regex based)
    private static String getJSONStringField(String json, String field) {
        Pattern pattern = Pattern.compile("\"" + field + "\"\\s*:\\s*(?:\"([^\"]+)\"|(\\d+))");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            if (matcher.group(1) != null) return matcher.group(1);
            return matcher.group(2);
        }
        return null;
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int len;
        while ((len = is.read(buffer)) != -1) {
            bos.write(buffer, 0, len);
        }
        return bos.toString(StandardCharsets.UTF_8.name());
    }

    private static void sendJSON(HttpExchange exchange, int statusCode, String response) throws IOException {
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }
}
