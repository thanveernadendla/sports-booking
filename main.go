package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	Port      = ":3000"
	SecretKey = "sportzone_super_secret_key_12345"
	DBFile    = "data/db.json"
)

// Data Models
type User struct {
	ID       int    `json:"id"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type Booking struct {
	ID     int    `json:"id"`
	Time   string `json:"time"`
	Venue  string `json:"venue"`
	Team   string `json:"team"`
	Status string `json:"status"`
	Date   string `json:"date"`
}

type DB struct {
	Users       []User         `json:"users"`
	Bookings    []Booking      `json:"bookings"`
	Utilization map[string]int `json:"utilization"`
}

type JWTPayload struct {
	ID    int    `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Exp   int64  `json:"exp"`
}

var dbMutex sync.Mutex

// DB Operations
func readDB() (DB, error) {
	dbMutex.Lock()
	defer dbMutex.Unlock()

	var db DB
	if _, err := os.Stat(DBFile); os.IsNotExist(err) {
		return DB{
			Users:       []User{},
			Bookings:    []Booking{},
			Utilization: make(map[string]int),
		}, nil
	}

	file, err := os.Open(DBFile)
	if err != nil {
		return db, err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	err = decoder.Decode(&db)
	return db, err
}

func writeDB(db DB) error {
	dbMutex.Lock()
	defer dbMutex.Unlock()

	err := os.MkdirAll(filepath.Dir(DBFile), 0755)
	if err != nil {
		return err
	}

	file, err := os.Create(DBFile)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(db)
}

// Helper functions for base64url encoding
func base64URLEncode(src []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(src), "=")
}

func base64URLDecode(src string) ([]byte, error) {
	if l := len(src) % 4; l > 0 {
		src += strings.Repeat("=", 4-l)
	}
	return base64.URLEncoding.DecodeString(src)
}

// JWT Logic
func generateJWT(userID int, email string, name string) (string, error) {
	header := `{"alg":"HS256","typ":"JWT"}`
	headerB64 := base64URLEncode([]byte(header))

	payload := JWTPayload{
		ID:    userID,
		Email: email,
		Name:  name,
		Exp:   time.Now().Add(24 * time.Hour).Unix(),
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	payloadB64 := base64URLEncode(payloadBytes)

	signingInput := headerB64 + "." + payloadB64

	h := hmac.New(sha256.New, []byte(SecretKey))
	h.Write([]byte(signingInput))
	signatureB64 := base64URLEncode(h.Sum(nil))

	return signingInput + "." + signatureB64, nil
}

func validateJWT(tokenString string) (*JWTPayload, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid token format")
	}

	signingInput := parts[0] + "." + parts[1]
	signature, err := base64URLDecode(parts[2])
	if err != nil {
		return nil, err
	}

	h := hmac.New(sha256.New, []byte(SecretKey))
	h.Write([]byte(signingInput))
	expectedSignature := h.Sum(nil)

	if !hmac.Equal(signature, expectedSignature) {
		return nil, errors.New("invalid signature")
	}

	payloadBytes, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, err
	}

	var payload JWTPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, err
	}

	if time.Now().Unix() > payload.Exp {
		return nil, errors.New("token expired")
	}

	return &payload, nil
}

// Middleware for CORS
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// Auth Middleware
func authenticate(r *http.Request) (*JWTPayload, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, errors.New("missing authorization header")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return nil, errors.New("invalid authorization header format")
	}

	return validateJWT(parts[1])
}

// Handlers
func main() {
	// Setup multiplexer
	mux := http.NewServeMux()

	// Page Routing
	mux.HandleFunc("/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			http.ServeFile(w, r, "public/index.html")
			return
		}
		if path == "/compare" {
			http.ServeFile(w, r, "public/compare.html")
			return
		}
		if path == "/dashboard" {
			http.ServeFile(w, r, "public/dashboard.html")
			return
		}
		if path == "/auth" {
			http.ServeFile(w, r, "public/auth.html")
			return
		}

		// Fallback for CSS, JS or general static files
		if strings.HasPrefix(path, "/css/") || strings.HasPrefix(path, "/js/") {
			http.FileServer(http.Dir("public")).ServeHTTP(w, r)
			return
		}

		http.NotFound(w, r)
	}))

	// API Routing
	mux.HandleFunc("/api/auth/register", corsMiddleware(handleRegister))
	mux.HandleFunc("/api/auth/login", corsMiddleware(handleLogin))
	mux.HandleFunc("/api/auth/me", corsMiddleware(handleMe))
	mux.HandleFunc("/api/bookings", corsMiddleware(handleBookings))
	mux.HandleFunc("/api/dashboard/stats", corsMiddleware(handleStats))

	log.Printf("SportZone Go Server is running on http://localhost%s", Port)
	if err := http.ListenAndServe(Port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Email, password, and name are required"})
		return
	}

	db, err := readDB()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for _, u := range db.Users {
		if strings.EqualFold(u.Email, req.Email) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "User already exists with this email"})
			return
		}
	}

	maxID := 0
	for _, u := range db.Users {
		if u.ID > maxID {
			maxID = u.ID
		}
	}

	newUser := User{
		ID:       maxID + 1,
		Email:    strings.ToLower(req.Email),
		Password: req.Password,
		Name:     req.Name,
	}

	db.Users = append(db.Users, newUser)
	if err := writeDB(db); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	token, err := generateJWT(newUser.ID, newUser.Email, newUser.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user": map[string]interface{}{
			"id":    newUser.ID,
			"email": newUser.Email,
			"name":  newUser.Name,
		},
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Email and password are required"})
		return
	}

	db, err := readDB()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var foundUser *User
	for _, u := range db.Users {
		if strings.EqualFold(u.Email, req.Email) && u.Password == req.Password {
			foundUser = &u
			break
		}
	}

	if foundUser == nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid email or password"})
		return
	}

	token, err := generateJWT(foundUser.ID, foundUser.Email, foundUser.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user": map[string]interface{}{
			"id":    foundUser.ID,
			"email": foundUser.Email,
			"name":  foundUser.Name,
		},
	})
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	payload, err := authenticate(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"user": payload,
	})
}

func handleBookings(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		db, err := readDB()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(db.Bookings)
		return
	}

	if r.Method == http.MethodPost {
		payload, err := authenticate(r)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		var req struct {
			Time  string `json:"time"`
			Venue string `json:"venue"`
			Team  string `json:"team"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		if req.Time == "" || req.Venue == "" || req.Team == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Time, venue, and team/name are required"})
			return
		}

		db, err := readDB()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		maxID := 0
		for _, b := range db.Bookings {
			if b.ID > maxID {
				maxID = b.ID
			}
		}

		newBooking := Booking{
			ID:     maxID + 1,
			Time:   req.Time,
			Venue:  req.Venue,
			Team:   req.Team,
			Status: "Confirmed",
			Date:   "2026-06-15",
		}

		db.Bookings = append(db.Bookings, newBooking)

		// Update utilization
		category := ""
		venueLower := strings.ToLower(req.Venue)
		if strings.Contains(venueLower, "football") {
			category = "Football Turf"
		} else if strings.Contains(venueLower, "basketball") {
			category = "Basketball"
		} else if strings.Contains(venueLower, "tennis") {
			category = "Tennis"
		} else if strings.Contains(venueLower, "badminton") {
			category = "Badminton"
		} else if strings.Contains(venueLower, "cricket") {
			category = "Cricket"
		}

		if category != "" {
			if val, ok := db.Utilization[category]; ok {
				newVal := val + 3
				if newVal > 100 {
					newVal = 100
				}
				db.Utilization[category] = newVal
			}
		}

		if err := writeDB(db); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		log.Printf("Created booking for %s at %s by user %s", req.Venue, req.Time, payload.Email)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newBooking)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	db, err := readDB()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	bookingsCount := 0
	for _, b := range db.Bookings {
		if b.Date == "2026-06-15" {
			bookingsCount++
		}
	}

	revenue := 24.6 + (float64(len(db.Bookings)) * 0.05)
	activePlayers := 1280 + len(db.Bookings)

	res := map[string]interface{}{
		"bookingsToday":     bookingsCount,
		"activeTournaments": 6,
		"activePlayers":     activePlayers,
		"revenueMonthly":    fmt.Sprintf("$%.1fk", revenue),
		"utilization":       db.Utilization,
	}

	json.NewEncoder(w).Encode(res)
}
