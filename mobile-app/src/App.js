import React, { useState, useEffect } from 'react';
import {
  AppRegistry,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  Platform,
  Modal
} from 'react-native';
import io from 'socket.io-client';

let AsyncStorageModule = null;
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('[Storage] Native AsyncStorage unavailable, using memory store');
}

const memoryStore = new Map();

const safeStorage = {
  getItem: async (key) => {
    try {
      if (AsyncStorageModule && typeof AsyncStorageModule.getItem === 'function') {
        return await AsyncStorageModule.getItem(key);
      }
    } catch (e) {}
    return memoryStore.get(key) || null;
  },
  setItem: async (key, val) => {
    try {
      if (AsyncStorageModule && typeof AsyncStorageModule.setItem === 'function') {
        await AsyncStorageModule.setItem(key, val);
        return;
      }
    } catch (e) {}
    memoryStore.set(key, val);
  },
  removeItem: async (key) => {
    try {
      if (AsyncStorageModule && typeof AsyncStorageModule.removeItem === 'function') {
        await AsyncStorageModule.removeItem(key);
        return;
      }
    } catch (e) {}
    memoryStore.delete(key);
  }
};

// Exact theme constants derived from the SportZone website CSS (frontend/styles/pro.css)
const THEME = {
  bg: '#eef3f8',              // --pro-bg: #eef3f8
  bgGradientStart: '#f8fafc', // linear-gradient 0%
  bgGradientMid: '#e2e8f0',   // linear-gradient 48%
  ink: '#111827',             // --pro-ink: #111827 (titles, main text)
  muted: '#64748b',           // --pro-muted: #64748b (subtitles, secondary)
  primary: '#0f766e',         // --pro-primary: #0f766e (teal brand button/badge)
  primaryDark: '#134e4a',     // --pro-primary-dark: #134e4a
  accent: '#f59e0b',          // --pro-accent: #f59e0b
  cardBg: '#ffffff',          // --pro-panel: rgba(255, 255, 255, 0.86)
  cardBorder: 'rgba(15, 23, 42, 0.12)', // --pro-line: rgba(15, 23, 42, 0.12)
  inputBg: '#ffffff',
  inputBorder: '#cbd5e1',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  success: '#16a34a',
  successBg: '#dcfce7',
  warningBg: '#fef3c7',
  warningText: '#92400e'
};

// Multi-Host Fallback URLs for Physical Android Devices, Emulators, & Localhost
const BACKEND_HOSTS = [
  'http://10.223.147.236:5000',
  'http://localhost:5000',
  'http://10.0.2.2:5000'
];

let activeBackendUrl = BACKEND_HOSTS[0];

const safeFetchJson = async (endpoint, options = {}) => {
  let lastError = null;
  const hostsToTry = [activeBackendUrl, ...BACKEND_HOSTS.filter(h => h !== activeBackendUrl)];

  for (const host of hostsToTry) {
    let timeoutId = null;
    try {
      const fullUrl = endpoint.startsWith('http') ? endpoint : `${host}${endpoint}`;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), 3500);
      }

      const res = await fetch(fullUrl, {
        ...options,
        signal: controller ? controller.signal : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      if (timeoutId) clearTimeout(timeoutId);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server error (${res.status}): Non-JSON response.`);
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
      }
      activeBackendUrl = host;
      return data;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;
      if (err.message && !err.message.toLowerCase().includes('network') && !err.message.toLowerCase().includes('fetch') && !err.message.toLowerCase().includes('abort') && !err.message.toLowerCase().includes('failed to connect')) {
        throw err;
      }
    }
  }
  throw lastError || new Error('Network Error: Unable to connect to SportZone backend server.');
};

export default function App() {
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Tab State: currentTab === 'home' | currentTab === 'booking' | currentTab === 'auth' | currentTab === 'admin' | currentTab === 'compare' | currentTab === 'admin_dashboard' | currentTab === 'admin_bookings' | currentTab === 'my_bookings' | currentTab === 'profile'
  const [currentTab, setCurrentTab] = useState('booking');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Auth Form State
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'admin_login'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');

  // Booking Form State
  const [config, setConfig] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [teamName, setTeamName] = useState('');
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [adminData, setAdminData] = useState(null);

  // Restore Persistent User Session on Launch
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const savedToken = await safeStorage.getItem('sportzone_token');
      const savedUserStr = await safeStorage.getItem('sportzone_user');
      if (savedToken && savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        setToken(savedToken);
        setCurrentUser(savedUser);
        if (savedUser.role === 'admin') {
          setCurrentTab('admin_dashboard');
          fetchAdminDashboard(savedToken);
        } else {
          setCurrentTab('booking');
          fetchMyBookings(savedToken);
        }
      }
    } catch (e) {
      console.log('[App] Session restoration error:', e.message);
    }
  };

  const saveSession = async (authToken, userObj) => {
    try {
      await safeStorage.setItem('sportzone_token', authToken);
      await safeStorage.setItem('sportzone_user', JSON.stringify(userObj));
    } catch (e) {
      console.log('[App] Session storage error:', e.message);
    }
  };

  // Real-Time Socket Connection & Data Refetching
  useEffect(() => {
    fetchConfig();
    fetchBookings();

    const socket = io(activeBackendUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      if (token) {
        socket.emit('authenticate', { token });
      }
      // On connection / reconnection, recover any missed state
      fetchConfig();
      fetchBookings();
      if (token && currentUser) {
        if (currentUser.role === 'admin') {
          fetchAdminDashboard(token);
        } else {
          fetchMyBookings(token);
        }
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('my_booking_updated', () => {
      fetchBookings();
      if (token) {
        fetchMyBookings(token);
      }
    });

    socket.on('admin_booking_updated', () => {
      fetchBookings();
      if (token) {
        fetchAdminDashboard(token);
      }
    });

    socket.on('booking_updated', () => {
      fetchBookings();
      fetchConfig();
      if (token && currentUser) {
        if (currentUser.role === 'admin') {
          fetchAdminDashboard(token);
        } else {
          fetchMyBookings(token);
        }
      }
    });

    socket.on('app_state_changed', () => {
      fetchConfig();
      fetchBookings();
      if (token && currentUser) {
        if (currentUser.role === 'admin') {
          fetchAdminDashboard(token);
        } else {
          fetchMyBookings(token);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, currentUser]);

  const fetchConfig = async () => {
    try {
      const data = await safeFetchJson('/api/config');
      setConfig(data);
      if (data.venues && data.venues.length > 0 && !selectedVenue) {
        setSelectedVenue(data.venues[0].name);
      }
    } catch (e) {
      console.log('[App] Config fetch error:', e.message);
    }
  };

  const fetchBookings = async () => {
    try {
      const data = await safeFetchJson('/api/bookings');
      if (Array.isArray(data)) setBookings(data);
    } catch (e) {
      console.log('[App] Bookings fetch error:', e.message);
    }
  };

  const fetchMyBookings = async (authToken) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    try {
      const data = await safeFetchJson('/api/bookings/my', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (Array.isArray(data)) {
        setMyBookings(data);
      }
    } catch (e) {
      console.log('[App] My Bookings fetch error:', e.message);
    }
  };

  const fetchAdminDashboard = async (authToken) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    try {
      const data = await safeFetchJson('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      setAdminData(data);
    } catch (e) {
      console.log('[App] Admin dashboard error:', e.message);
    }
  };

  // Auth Handler: User Login
  const handleUserLogin = async () => {
    setAuthError('');
    if (!phone || !password) {
      setAuthError('Please enter mobile number/email and password.');
      return;
    }
    setLoading(true);
    try {
      // Clear previous cached account data
      setBookings([]);
      setMyBookings([]);
      setAdminData(null);

      const data = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password })
      });
      setToken(data.token);
      setCurrentUser(data.user);
      await saveSession(data.token, data.user);
      setCurrentTab('booking');
      await fetchMyBookings(data.token);
      await fetchBookings();
      Alert.alert('Welcome Back', `Logged in successfully as ${data.user.name}`);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auth Handler: User Signup
  const handleUserRegister = async () => {
    setAuthError('');
    if (!name || !phone || !password) {
      setAuthError('Please provide your full name, 10-digit mobile number, and password.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    try {
      // Clear previous cached account data
      setBookings([]);
      setMyBookings([]);
      setAdminData(null);

      const data = await safeFetchJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, phone, password })
      });
      setToken(data.token);
      setCurrentUser(data.user);
      await saveSession(data.token, data.user);
      setCurrentTab('booking');
      await fetchMyBookings(data.token);
      await fetchBookings();
      Alert.alert('Account Created', `Welcome to SportZone, ${data.user.name}!`);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auth Handler: Admin Login
  const handleAdminLogin = async () => {
    setAuthError('');
    if (!phone || !password) {
      setAuthError('Please enter admin credentials.');
      return;
    }
    setLoading(true);
    try {
      // Clear previous cached account data
      setBookings([]);
      setMyBookings([]);
      setAdminData(null);

      const data = await safeFetchJson('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: phone, password })
      });
      setToken(data.token);
      setCurrentUser(data.user);
      await saveSession(data.token, data.user);
      setCurrentTab('admin_dashboard');
      await fetchAdminDashboard(data.token);
      Alert.alert('Admin Access', `Welcome Admin ${data.user.name}!`);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Booking Actions
  const handleCreateBooking = async () => {
    if (!token) {
      Alert.alert('Login Required', 'Please sign in to complete your booking.');
      return;
    }
    if (!selectedVenue || !selectedSlot || !teamName) {
      Alert.alert('Incomplete Form', 'Please select venue, time slot, and enter team name.');
      return;
    }
    setLoading(true);
    try {
      await safeFetchJson('/api/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venue: selectedVenue, time: selectedSlot, team: teamName })
      });
      Alert.alert('Booking Confirmed', 'Your court booking has been registered successfully!');
      setTeamName('');
      setSelectedSlot('');
      await fetchBookings();
      await fetchMyBookings(token);
    } catch (e) {
      Alert.alert('Booking Failure', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!token) return;
    try {
      await safeFetchJson(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Booking Cancelled', 'Booking reservation cancelled successfully.');
      await fetchBookings();
      await fetchMyBookings(token);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // Admin Booking Management Actions
  const handleAdminUpdateBookingStatus = async (bookingId, newStatus) => {
    if (!token) return;
    setActionLoadingId(bookingId);
    try {
      await safeFetchJson(`/api/admin/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      Alert.alert('Status Updated', `Booking #${bookingId} marked as ${newStatus}.`);
      await fetchAdminDashboard(token);
      await fetchBookings();
    } catch (e) {
      Alert.alert('Action Failed', e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdminDeleteBooking = async (bookingId) => {
    if (!token) return;
    setActionLoadingId(bookingId);
    try {
      await safeFetchJson(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Booking Removed', `Booking #${bookingId} deleted permanently.`);
      await fetchAdminDashboard(token);
      await fetchBookings();
    } catch (e) {
      Alert.alert('Action Failed', e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await safeStorage.removeItem('sportzone_token');
      await safeStorage.removeItem('sportzone_user');
    } catch (e) {}
    setToken(null);
    setCurrentUser(null);
    setAdminData(null);
    setBookings([]);
    setMyBookings([]);
    setTeamName('');
    setSelectedSlot('');
    setAuthMode('login');
    setDrawerOpen(false);
    setCurrentTab('booking');
    Alert.alert('Signed Out', 'You have been signed out successfully.');
  };

  // Render Authentication Screen when Unauthenticated
  if (!token || !currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
        <View style={styles.ambientGlowTopLeft} pointerEvents="none" />
        <View style={styles.ambientGlowTopRight} pointerEvents="none" />
        <ScrollView contentContainerStyle={styles.authScrollContent}>

          {/* Authentication Mode Tabs */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, authMode === 'login' && styles.modeBtnActive]}
              onPress={() => { setAuthMode('login'); setAuthError(''); }}>
              <Text style={[styles.modeBtnText, authMode === 'login' && styles.modeBtnTextActive]}>User Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, authMode === 'register' && styles.modeBtnActive]}
              onPress={() => { setAuthMode('register'); setAuthError(''); }}>
              <Text style={[styles.modeBtnText, authMode === 'register' && styles.modeBtnTextActive]}>User Signup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, authMode === 'admin_login' && styles.modeBtnActive]}
              onPress={() => { setAuthMode('admin_login'); setAuthError(''); }}>
              <Text style={[styles.modeBtnText, authMode === 'admin_login' && styles.modeBtnTextActive]}>Admin</Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.refCard}>
            <Text style={styles.refKicker}>SPORTZONE PLATFORM</Text>
            <Text style={styles.refTitle}>
              {authMode === 'login' ? 'Sign in to your account' : authMode === 'register' ? 'Create new account' : 'Admin Access Portal'}
            </Text>
            <Text style={styles.refSubtitle}>
              {authMode === 'login' ? 'Enterprise Sports Booking Platform' : authMode === 'register' ? 'Book turf and courts instantly' : 'System Administration Controls'}
            </Text>

            {authError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {authError}</Text>
              </View>
            ) : null}

            {authMode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.refInput}
                  placeholder="e.g. John Doe"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {authMode === 'admin_login' ? 'Admin Username / Phone' : 'Mobile Number'}
              </Text>
              <TextInput
                style={styles.refInput}
                placeholder={authMode === 'admin_login' ? 'admin' : '10-digit mobile number'}
                placeholderTextColor="#94a3b8"
                value={phone}
                onChangeText={setPhone}
                keyboardType={authMode === 'admin_login' ? 'default' : 'phone-pad'}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.refPasswordWrapper}>
                <TextInput
                  style={styles.refPasswordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIconButton}
                  onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eyeIconText}>{showPassword ? '🙈' : '🐵'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.refPrimaryButton}
              onPress={authMode === 'login' ? handleUserLogin : authMode === 'register' ? handleUserRegister : handleAdminLogin}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.refPrimaryButtonText}>
                  {authMode === 'login' ? 'Secure Sign In' : authMode === 'register' ? 'Register Account' : 'Secure Admin Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.refFooterLinkRow}>
              {authMode === 'register' ? (
                <Text style={styles.refFooterText}>
                  Already have an account?{' '}
                  <Text
                    style={styles.refFooterLink}
                    onPress={() => { setAuthMode('login'); setAuthError(''); }}>
                    Sign in
                  </Text>
                </Text>
              ) : (
                <Text style={styles.refFooterText}>
                  Don't have an account?{' '}
                  <Text
                    style={styles.refFooterLink}
                    onPress={() => { setAuthMode('register'); setAuthError(''); }}>
                    Create one
                  </Text>
                </Text>
              )}
            </View>
          </View>

          {/* Clean footer with NO real-time sync badge */}
          <View style={styles.footerNote}>
            <Text style={styles.footerText}>⚡ SportZone Mobile Engine</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isAdmin = currentUser?.role === 'admin';

  // Authenticated Screen with Header, Hamburger Drawer Modal, and Role-Based Navigation
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.ambientGlowTopLeft} pointerEvents="none" />
      <View style={styles.ambientGlowTopRight} pointerEvents="none" />

      {/* Top Navbar Header (Logo, "Booking App", and Hamburger Button) */}
      <View style={styles.topHeader}>
        <View style={styles.brandGroup}>
          <Text style={styles.brandBadge}>SZ</Text>
          <View>
            <Text style={styles.brandTitle}>SportZone</Text>
            <Text style={styles.brandSubtitle}>Booking App</Text>
          </View>
        </View>

        {/* 3-Line Rectangular Hamburger Menu Button */}
        <TouchableOpacity
          style={styles.hamburgerBtn}
          onPress={() => setDrawerOpen(true)}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
      </View>

      {/* Main Content Screens */}
      <ScrollView contentContainerStyle={styles.content}>

        {/* REGULAR USER: BOOKING SCREEN */}
        {!isAdmin && currentTab === 'booking' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Book Courts & Browse Venues</Text>

            <Text style={styles.inputLabel}>1. Select Venue:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {config?.venues?.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, selectedVenue === v.name && styles.chipActive]}
                  onPress={() => setSelectedVenue(v.name)}>
                  <Text style={[styles.chipText, selectedVenue === v.name && styles.chipTextActive]}>
                    {v.name} (₹{v.fee})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>2. Select Available Slot:</Text>
            <View style={styles.slotGrid}>
              {config?.timeSlots?.map(slot => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slotCard, selectedSlot === slot && styles.slotCardActive]}
                  onPress={() => setSelectedSlot(slot)}>
                  <Text style={[styles.slotCardText, selectedSlot === slot && styles.slotCardTextActive]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>3. Team / Player Name:</Text>
            <TextInput
              style={styles.refInput}
              placeholder="e.g. Thunder Strikers"
              placeholderTextColor="#94a3b8"
              value={teamName}
              onChangeText={setTeamName}
            />

            <TouchableOpacity style={styles.refPrimaryButton} onPress={handleCreateBooking} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.refPrimaryButtonText}>Confirm Court Booking</Text>}
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Today's Confirmed Slots</Text>
            {bookings.length === 0 ? (
              <Text style={styles.emptyText}>All slots are currently open for today.</Text>
            ) : (
              bookings.map(b => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingVenue}>{b.venue}</Text>
                    <Text style={styles.bookingTime}>{b.time}</Text>
                  </View>
                  <Text style={styles.bookingSub}>Team: {b.team} | Fee: ₹{b.fee}</Text>
                  <View style={styles.bookingFooter}>
                    <Text style={[styles.statusTag, b.status === 'Approved' ? styles.statusApproved : styles.statusPending]}>
                      Status: {b.status}
                    </Text>
                    {b.userId === currentUser.id && (
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteBooking(b.id)}>
                        <Text style={styles.deleteBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* REGULAR USER: MY BOOKINGS SCREEN */}
        {!isAdmin && currentTab === 'my_bookings' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Bookings</Text>
            {myBookings.length === 0 ? (
              <Text style={styles.emptyText}>You have no bookings reserved yet.</Text>
            ) : (
              myBookings.map(b => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingVenue}>{b.venue} @ {b.time}</Text>
                    <Text style={[styles.statusTag, b.status === 'Approved' ? styles.statusApproved : b.status === 'Rejected' ? styles.statusRejected : styles.statusPending]}>
                      {b.status}
                    </Text>
                  </View>
                  <Text style={styles.bookingSub}>Team: {b.team} | Date: {b.date || 'Today'} | Fee: ₹{b.fee}</Text>
                  <TouchableOpacity style={[styles.deleteBtn, { marginTop: 8 }]} onPress={() => handleDeleteBooking(b.id)}>
                    <Text style={styles.deleteBtnText}>Cancel Booking</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ADMIN: DASHBOARD SCREEN */}
        {isAdmin && currentTab === 'admin_dashboard' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Dashboard</Text>
            {adminData ? (
              <View>
                <View style={styles.statGrid}>
                  <View style={styles.statCard}><Text style={styles.statVal}>{adminData.stats.users}</Text><Text style={styles.statLabel}>Customers</Text></View>
                  <View style={styles.statCard}><Text style={styles.statVal}>{adminData.stats.pendingBookings}</Text><Text style={styles.statLabel}>Pending</Text></View>
                  <View style={styles.statCard}><Text style={styles.statVal}>{adminData.stats.revenue}</Text><Text style={styles.statLabel}>Revenue</Text></View>
                </View>

                <View style={[styles.statGrid, { marginTop: 10 }]}>
                  <View style={styles.statCard}><Text style={styles.statVal}>{adminData.stats.bookingsToday}</Text><Text style={styles.statLabel}>Bookings Today</Text></View>
                  <View style={styles.statCard}><Text style={styles.statVal}>{adminData.stats.availableSlots}</Text><Text style={styles.statLabel}>Open Slots</Text></View>
                  <View style={styles.statCard}><Text style={styles.statVal}>{adminData.stats.venues}</Text><Text style={styles.statLabel}>Active Venues</Text></View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Quick Actions</Text>
                <TouchableOpacity style={styles.refPrimaryButton} onPress={() => setCurrentTab('admin_bookings')}>
                  <Text style={styles.refPrimaryButtonText}>Manage All Platform Bookings →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ActivityIndicator color="#0284c7" style={{ marginTop: 20 }} />
            )}
          </View>
        )}

        {/* ADMIN: BOOKING MANAGEMENT SCREEN */}
        {isAdmin && currentTab === 'admin_bookings' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Management</Text>
            <Text style={styles.bookingSub}>Authorized platform-wide booking approvals & operations</Text>

            {adminData?.bookings && adminData.bookings.length > 0 ? (
              adminData.bookings.map(b => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingVenue}>{b.venue}</Text>
                    <Text style={styles.bookingTime}>{b.time} ({b.date || 'Today'})</Text>
                  </View>
                  <Text style={styles.bookingSub}>
                    Customer: {b.customerName || 'User'} ({b.customerPhone || 'N/A'})
                  </Text>
                  <Text style={styles.bookingSub}>
                    Team: {b.team} | Fee: ₹{b.fee}
                  </Text>
                  <View style={styles.bookingFooter}>
                    <Text style={[styles.statusTag, b.status === 'Approved' ? styles.statusApproved : b.status === 'Rejected' ? styles.statusRejected : styles.statusPending]}>
                      Status: {b.status}
                    </Text>
                  </View>

                  {/* Working Admin Actions: Approve, Reject, Delete */}
                  <View style={styles.adminActionRow}>
                    {b.status !== 'Approved' && (
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleAdminUpdateBookingStatus(b.id, 'Approved')}
                        disabled={actionLoadingId === b.id}>
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    )}
                    {b.status !== 'Rejected' && (
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleAdminUpdateBookingStatus(b.id, 'Rejected')}
                        disabled={actionLoadingId === b.id}>
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleAdminDeleteBooking(b.id)}
                      disabled={actionLoadingId === b.id}>
                      <Text style={styles.deleteBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No platform bookings registered yet.</Text>
            )}
          </View>
        )}

        {/* ADMIN: MANAGED VENUES SCREEN */}
        {isAdmin && currentTab === 'admin_venues' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Managed Venues & Prices</Text>
            {adminData?.venues ? (
              adminData.venues.map(v => (
                <View key={v.id} style={styles.venueCard}>
                  <Text style={styles.venueName}>{v.name}</Text>
                  <Text style={styles.venueCategory}>Category: {v.category} | Pricing: ₹{v.fee}</Text>
                  <Text style={[styles.bookingSub, { marginTop: 4 }]}>
                    Status: {v.status || 'Approved'} | Booked Today: {v.booked || 0}
                  </Text>
                </View>
              ))
            ) : (
              <ActivityIndicator color="#0284c7" />
            )}
          </View>
        )}

        {/* PROFILE SCREEN (Both Regular User and Admin) */}
        {currentTab === 'profile' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isAdmin ? 'Admin Profile' : 'Account Profile'}</Text>
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}</Text>
              </View>
              <Text style={styles.profileName}>{currentUser.name}</Text>
              <Text style={styles.profileRoleBadge}>
                {isAdmin ? 'ADMINISTRATOR' : 'CUSTOMER ACCOUNT'}
              </Text>

              <View style={styles.profileDetailRow}>
                <Text style={styles.profileLabel}>{isAdmin ? 'Admin Username:' : 'Mobile Number:'}</Text>
                <Text style={styles.profileVal}>{currentUser.phone || currentUser.username}</Text>
              </View>

              <View style={styles.profileDetailRow}>
                <Text style={styles.profileLabel}>Account ID:</Text>
                <Text style={styles.profileVal}>#{currentUser.id}</Text>
              </View>

              <View style={styles.profileDetailRow}>
                <Text style={styles.profileLabel}>Account Status:</Text>
                <Text style={[styles.profileVal, { color: '#22c55e' }]}>{currentUser.status || 'Approved'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutOutlineBtn} onPress={handleLogout}>
              <Text style={styles.logoutOutlineBtnText}>Sign Out of SportZone</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Hamburger Drawer Modal Navigation Menu */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={drawerOpen}
        onRequestClose={() => setDrawerOpen(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}>
          <View style={styles.drawerContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                <Text style={styles.drawerAvatarText}>{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}</Text>
              </View>
              <View>
                <Text style={styles.drawerName}>{currentUser.name}</Text>
                <Text style={styles.drawerPhone}>{isAdmin ? 'ADMIN' : (currentUser.phone || 'USER')}</Text>
              </View>
            </View>

            <View style={styles.drawerDivider} />

            {/* ROLE-SPECIFIC NAVIGATION MENU ITEMS */}
            {isAdmin ? (
              /* ADMINISTRATOR MENU: NO generic "Admin" option; specific admin features */
              <>
                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('profile'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>👤</Text>
                  <Text style={styles.drawerItemText}>Admin Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('profile'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>📋</Text>
                  <Text style={styles.drawerItemText}>Admin Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('admin_dashboard'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>📊</Text>
                  <Text style={styles.drawerItemText}>Admin Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('admin_bookings'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>📑</Text>
                  <Text style={styles.drawerItemText}>Booking Management</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('admin_venues'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>🏟️</Text>
                  <Text style={styles.drawerItemText}>Managed Venues</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* REGULAR USER MENU: NO Admin menu option or admin-only screens */
              <>
                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('profile'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>📱</Text>
                  <Text style={styles.drawerItemText}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('profile'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>📋</Text>
                  <Text style={styles.drawerItemText}>Account Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('booking'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>🏟️</Text>
                  <Text style={styles.drawerItemText}>Book Courts</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => { setCurrentTab('my_bookings'); setDrawerOpen(false); }}>
                  <Text style={styles.drawerItemIcon}>⚽</Text>
                  <Text style={styles.drawerItemText}>My Bookings</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.drawerLogoutBtn} onPress={handleLogout}>
              <Text style={styles.drawerLogoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  authScrollContent: { padding: 20, justifyContent: 'center', minHeight: '100%', backgroundColor: THEME.bg },
  
  ambientGlowTopLeft: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(20, 184, 166, 0.18)',
  },
  ambientGlowTopRight: {
    position: 'absolute',
    top: 60,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },

  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: THEME.primary },
  modeBtnText: { color: THEME.muted, fontWeight: '600', fontSize: 13 },
  modeBtnTextActive: { color: '#ffffff', fontWeight: '800' },

  refCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4
  },
  refKicker: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 8
  },
  refTitle: {
    color: THEME.ink,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6
  },
  refSubtitle: {
    color: THEME.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24
  },
  errorBox: {
    backgroundColor: THEME.dangerBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  errorText: { color: '#991b1b', fontSize: 13, fontWeight: '600' },
  
  inputGroup: { marginBottom: 18 },
  inputLabel: { color: '#334155', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  refInput: {
    backgroundColor: THEME.inputBg,
    color: THEME.ink,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.inputBorder,
    fontSize: 15
  },
  refPasswordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.inputBorder,
    paddingRight: 12
  },
  refPasswordInput: {
    flex: 1,
    color: THEME.ink,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15
  },
  eyeIconButton: { padding: 4 },
  eyeIconText: { fontSize: 20 },

  refPrimaryButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4
  },
  refPrimaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16
  },
  refFooterLinkRow: {
    marginTop: 24,
    alignItems: 'center'
  },
  refFooterText: {
    color: THEME.muted,
    fontSize: 14
  },
  refFooterLink: {
    color: THEME.primary,
    fontWeight: '800',
    textDecorationLine: 'underline'
  },

  footerNote: { alignItems: 'center', marginTop: 24 },
  footerText: { color: THEME.muted, fontSize: 12 },

  topHeader: {
    height: 64,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: THEME.cardBorder,
    elevation: 2
  },
  brandGroup: { flexDirection: 'row', alignItems: 'center' },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    fontSize: 16,
    marginRight: 10
  },
  brandTitle: { color: THEME.ink, fontSize: 17, fontWeight: '800' },
  brandSubtitle: { color: THEME.primary, fontSize: 11, fontWeight: '700' },
  hamburgerBtn: {
    width: 44,
    height: 38,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  hamburgerLine: {
    width: 22,
    height: 2.5,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginVertical: 2
  },
  
  content: { padding: 16, backgroundColor: THEME.bg },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: THEME.ink, marginBottom: 14 },

  chipRow: { flexDirection: 'row', marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: THEME.inputBorder
  },
  chipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  chipText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#ffffff', fontWeight: '800' },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  slotCard: {
    width: '30%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.inputBorder,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  slotCardActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  slotCardText: { color: '#334155', fontWeight: '600' },
  slotCardTextActive: { color: '#ffffff', fontWeight: '800' },

  venueCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  venueName: { color: THEME.ink, fontWeight: '800', fontSize: 16 },
  venueCategory: { color: THEME.muted, fontSize: 13 },

  bookingCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  bookingVenue: { color: THEME.ink, fontWeight: '800', fontSize: 15 },
  bookingTime: { color: THEME.primary, fontWeight: '700' },
  bookingSub: { color: THEME.muted, fontSize: 13, marginBottom: 8 },
  bookingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTag: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusApproved: { color: '#166534', backgroundColor: '#dcfce7' },
  statusPending: { color: '#92400e', backgroundColor: '#fef3c7' },
  statusRejected: { color: '#991b1b', backgroundColor: '#fee2e2' },
  deleteBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5' },
  deleteBtnText: { color: '#dc2626', fontWeight: '800', fontSize: 12 },

  adminActionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: { backgroundColor: '#15803d', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  approveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  rejectBtn: { backgroundColor: '#b91c1c', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  rejectBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },

  profileCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  avatarText: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  profileName: { color: THEME.ink, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  profileRoleBadge: {
    color: THEME.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16
  },
  profileDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  profileLabel: { color: THEME.muted, fontSize: 14, fontWeight: '600' },
  profileVal: { color: THEME.ink, fontWeight: '800', fontSize: 14 },
  logoutOutlineBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dc2626',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  logoutOutlineBtnText: { color: '#dc2626', fontWeight: '800', fontSize: 15 },

  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  statVal: { color: THEME.primary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: THEME.muted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  emptyText: { color: THEME.muted, fontStyle: 'italic', marginVertical: 12 },

  // Drawer Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start' },
  drawerContainer: {
    width: '80%',
    height: '100%',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 12 },
  drawerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  drawerAvatarText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  drawerName: { color: THEME.ink, fontSize: 16, fontWeight: '800' },
  drawerPhone: { color: THEME.primary, fontSize: 13, fontWeight: '700' },
  drawerDivider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: 16 },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4
  },
  drawerItemIcon: { fontSize: 18, marginRight: 12 },
  drawerItemText: { color: THEME.ink, fontWeight: '700', fontSize: 15 },
  drawerLogoutBtn: {
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  drawerLogoutText: { color: '#dc2626', fontWeight: '800', fontSize: 15 }
});

AppRegistry.registerComponent('SportZone', () => App);
