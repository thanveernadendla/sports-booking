using System;
using System.Drawing;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Linq;

namespace SmartHotelMS
{
    public enum RoomStatus {
        Available,
        Reserved,
        Occupied,
        Cleaning,
        Maintenance
    }

    public enum RoomType {
        Single = 2000,
        Double = 3000,
        Deluxe = 4000,
        Executive = 6000
    }

    public class Room
    {
        public string RoomNumber { get; set; }
        public RoomType Type { get; set; }
        public int Floor { get; set; }
        public int Capacity { get; set; }
        public RoomStatus Status { get; set; }

        public double PricePerNight
        {
            get { return (double)Type; }
        }
    }

    public class Guest
    {
        public string GuestID { get; set; }
        public string FullName { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string IDProof { get; set; }
    }

    public class ServiceCharge
    {
        public string Category { get; set; }
        public string Description { get; set; }
        public double Amount { get; set; }
        public DateTime DatePosted { get; set; }
    }

    public class Reservation
    {
        public string BookingID { get; set; }
        public Guest GuestProfile { get; set; }
        public Room AssignedRoom { get; set; }
        public DateTime CheckInDate { get; set; }
        public DateTime CheckOutDate { get; set; }
        public string Stage { get; set; }

        public List<ServiceCharge> Services { get; set; }
        public double Discount { get; set; }
        public double AdvancePaid { get; set; }
        public bool IsPaid { get; set; }

        public Reservation()
        {
            Services = new List<ServiceCharge>();
            Discount = 0.0;
            AdvancePaid = 0.0;
            IsPaid = false;
        }

        public int Nights
        {
            get { return Math.Max(1, (CheckOutDate - CheckInDate).Days); }
        }

        public double RoomTotal
        {
            get { return AssignedRoom.PricePerNight * Nights; }
        }

        public double ServiceTotal
        {
            get { return Services.Sum(s => s.Amount); }
        }

        public double Subtotal
        {
            get { return RoomTotal + ServiceTotal; }
        }

        public double Tax
        {
            get { return Subtotal * 0.18; }
        }

        public double GrandTotal
        {
            get { return (Subtotal + Tax) - Discount; }
        }

        public double TotalDue
        {
            get { return GrandTotal - AdvancePaid; }
        }
    }

    public class MainWindow : Form
    {
        Color cPrimary = Color.FromArgb(30, 41, 59);
        Color cSecondary = Color.FromArgb(37, 99, 235);
        Color cBg = Color.FromArgb(241, 245, 249);
        Color cCard = Color.White;
        Color cTextDark = Color.FromArgb(15, 23, 42);
        Color cTextMuted = Color.FromArgb(100, 116, 139);

        Color cAvailable = Color.FromArgb(34, 197, 94);
        Color cReserved = Color.FromArgb(245, 158, 11);
        Color cOccupied = Color.FromArgb(239, 68, 68);
        Color cCleaning = Color.FromArgb(6, 182, 212);
        Color cMaintenance = Color.FromArgb(139, 92, 246);

        public List<Room> RoomsDB = new List<Room>();
        public List<Guest> GuestsDB = new List<Guest>();
        public List<Reservation> ReservationsDB = new List<Reservation>();

        Panel sidebarPanel;
        Panel headerPanel;
        Panel contentArea;

        public MainWindow()
        {
            Text = "Smart Hotel Management System";
            Size = new Size(1280, 768);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = cBg;

            SeedData();
            BuildLayout();
            ShowDashboard();
        }

        void SeedData()
        {
            RoomsDB.Add(new Room { RoomNumber = "101", Type = RoomType.Single, Floor = 1, Capacity = 1, Status = RoomStatus.Available });
            RoomsDB.Add(new Room { RoomNumber = "102", Type = RoomType.Deluxe, Floor = 1, Capacity = 2, Status = RoomStatus.Occupied });
            RoomsDB.Add(new Room { RoomNumber = "103", Type = RoomType.Double, Floor = 1, Capacity = 2, Status = RoomStatus.Reserved });
            RoomsDB.Add(new Room { RoomNumber = "104", Type = RoomType.Single, Floor = 1, Capacity = 1, Status = RoomStatus.Cleaning });
            RoomsDB.Add(new Room { RoomNumber = "105", Type = RoomType.Executive, Floor = 1, Capacity = 4, Status = RoomStatus.Maintenance });
            RoomsDB.Add(new Room { RoomNumber = "201", Type = RoomType.Deluxe, Floor = 2, Capacity = 2, Status = RoomStatus.Available });
            RoomsDB.Add(new Room { RoomNumber = "202", Type = RoomType.Executive, Floor = 2, Capacity = 4, Status = RoomStatus.Available });

            Guest g1 = new Guest { GuestID = "GST-1001", FullName = "Prakash Kumar", Phone = "9876543210", Email = "prakash@example.com", IDProof = "AADHAAR-[Redacted]" };
            Guest g2 = new Guest { GuestID = "GST-1002", FullName = "Anita Sharma", Phone = "9123456789", Email = "anita@example.com", IDProof = "PASSPORT-K3321" };

            GuestsDB.Add(g1);
            GuestsDB.Add(g2);

            Reservation r1 = new Reservation {
                BookingID = "BK-8001",
                GuestProfile = g1,
                AssignedRoom = RoomsDB[1],
                CheckInDate = DateTime.Now.AddDays(-2),
                CheckOutDate = DateTime.Now.AddDays(1),
                Stage = "Checked-In",
                AdvancePaid = 2000
            };

            r1.Services.Add(new ServiceCharge { Category = "Room Service", Description = "Food and Beverages", Amount = 1200, DatePosted = DateTime.Now });

            ReservationsDB.Add(r1);
        }

        void BuildLayout()
        {
            sidebarPanel = new Panel { Dock = DockStyle.Left, Width = 220, BackColor = cPrimary };

            Label logo = new Label { Text = "SMART HOTEL", ForeColor = Color.White, Font = new Font("Segoe UI", 16, FontStyle.Bold), Location = new Point(20, 25), AutoSize = true };
            Label subtitle = new Label { Text = "EDGE MANAGEMENT SYSTEM", ForeColor = Color.LightGray, Font = new Font("Segoe UI", 7), Location = new Point(22, 55), AutoSize = true };

            sidebarPanel.Controls.Add(logo);
            sidebarPanel.Controls.Add(subtitle);

            AddNavButton("Dashboard", 110, delegate { ShowDashboard(); });
            AddNavButton("Rooms", 160, delegate { ShowRooms(); });
            AddNavButton("Reservations", 210, delegate { ShowReservations(); });
            AddNavButton("Check-In", 260, delegate { ShowCheckIn(); });
            AddNavButton("Billing", 310, delegate { ShowBilling(); });
            AddNavButton("Smart Energy", 360, delegate { ShowSmartEnergy(); });
            AddNavButton("Housekeeping", 410, delegate { ShowHousekeeping(); });
            AddNavButton("Maintenance", 460, delegate { ShowMaintenance(); });
            AddNavButton("AI Concierge", 510, delegate { ShowAIConcierge(); });

            headerPanel = new Panel { Dock = DockStyle.Top, Height = 70, BackColor = Color.White };

            Label header = new Label { Text = "Smart Hotel Operations Dashboard", Font = new Font("Segoe UI", 16, FontStyle.Bold), ForeColor = cTextDark, Location = new Point(25, 22), AutoSize = true };
            Label status = new Label { Text = "? EDGE SYSTEM ONLINE", Font = new Font("Segoe UI", 9, FontStyle.Bold), ForeColor = cAvailable, Location = new Point(750, 25), AutoSize = true };

            headerPanel.Controls.Add(header);
            headerPanel.Controls.Add(status);

            contentArea = new Panel { Dock = DockStyle.Fill, BackColor = cBg, AutoScroll = true };

            Controls.Add(contentArea);
            Controls.Add(headerPanel);
            Controls.Add(sidebarPanel);
        }

        void AddNavButton(string text, int y, EventHandler click)
        {
            Button btn = new Button {
                Text = text,
                Location = new Point(15, y),
                Size = new Size(190, 40),
                FlatStyle = FlatStyle.Flat,
                BackColor = cPrimary,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10),
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(15, 0, 0, 0)
            };
            btn.FlatAppearance.BorderSize = 0;
            btn.Click += click;

            sidebarPanel.Controls.Add(btn);
        }

        Panel CreateCard(int x, int y, int w, int h)
        {
            return new Panel {
                Location = new Point(x, y),
                Size = new Size(w, h),
                BackColor = cCard,
                BorderStyle = BorderStyle.FixedSingle
            };
        }

        void AddCardText(Panel card, string title, string value, Color valueColor)
        {
            Label lblTitle = new Label { Text = title, Font = new Font("Segoe UI", 9), ForeColor = cTextMuted, Location = new Point(18, 15), AutoSize = true };
            Label lblValue = new Label { Text = value, Font = new Font("Segoe UI", 24, FontStyle.Bold), ForeColor = valueColor, Location = new Point(18, 45), AutoSize = true };

            card.Controls.Add(lblTitle);
            card.Controls.Add(lblValue);
        }

        void ShowDashboard()
        {
            contentArea.Controls.Clear();

            int available = RoomsDB.Count(r => r.Status == RoomStatus.Available);
            int occupied = RoomsDB.Count(r => r.Status == RoomStatus.Occupied);
            int reserved = RoomsDB.Count(r => r.Status == RoomStatus.Reserved);

            Panel c1 = CreateCard(25, 25, 210, 120);
            AddCardText(c1, "AVAILABLE ROOMS", available.ToString(), cAvailable);

            Panel c2 = CreateCard(250, 25, 210, 120);
            AddCardText(c2, "OCCUPIED ROOMS", occupied.ToString(), cOccupied);

            Panel c3 = CreateCard(475, 25, 210, 120);
            AddCardText(c3, "RESERVED ROOMS", reserved.ToString(), cReserved);

            Panel c4 = CreateCard(700, 25, 260, 120);
            AddCardText(c4, "ACTIVE BOOKINGS", ReservationsDB.Count.ToString(), cSecondary);

            Label section = new Label { Text = "Live Edge Hotel Intelligence", Font = new Font("Segoe UI", 16, FontStyle.Bold), ForeColor = cTextDark, Location = new Point(25, 180), AutoSize = true };

            ListBox intelligence = new ListBox { Location = new Point(25, 225), Size = new Size(935, 260), Font = new Font("Segoe UI", 11) };

            intelligence.Items.Add("? Local hotel system running normally - Internet connection not required");
            intelligence.Items.Add("? MQTT edge communication simulated - Local operations active");
            intelligence.Items.Add("? Housekeeping automation checking room vacancy conditions");
            intelligence.Items.Add("? Predictive maintenance monitoring AC and water usage");
            intelligence.Items.Add("? Guest energy rewards system active");
            intelligence.Items.Add("? AI Concierge available through local hotel network");
            intelligence.Items.Add("? All hotel records maintained in local system memory");

            contentArea.Controls.AddRange(new Control[] { c1, c2, c3, c4, section, intelligence });
        }

        void ShowRooms()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Room Management", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            DataGridView grid = new DataGridView {
                Location = new Point(25, 70),
                Size = new Size(935, 450),
                BackgroundColor = Color.White,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                ReadOnly = true
            };

            grid.Columns.Add("Room", "Room No.");
            grid.Columns.Add("Type", "Room Type");
            grid.Columns.Add("Floor", "Floor");
            grid.Columns.Add("Capacity", "Capacity");
            grid.Columns.Add("Price", "Price/Night");
            grid.Columns.Add("Status", "Status");

            foreach (Room r in RoomsDB)
            {
                grid.Rows.Add(r.RoomNumber, r.Type.ToString(), r.Floor, r.Capacity, "?" + r.PricePerNight, r.Status.ToString());
            }

            contentArea.Controls.AddRange(new Control[] { title, grid });
        }

        void ShowReservations()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Reservation Management", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            Panel bookingPanel = CreateCard(25, 70, 935, 150);

            Label gLabel = new Label { Text = "Guest", Location = new Point(20, 20), AutoSize = true };
            ComboBox cbGuest = new ComboBox { Location = new Point(20, 45), Width = 180, DropDownStyle = ComboBoxStyle.DropDownList };
            foreach (Guest g in GuestsDB) cbGuest.Items.Add(g.FullName);
            if (cbGuest.Items.Count > 0) cbGuest.SelectedIndex = 0;

            Label rLabel = new Label { Text = "Available Room", Location = new Point(220, 20), AutoSize = true };
            ComboBox cbRoom = new ComboBox { Location = new Point(220, 45), Width = 150, DropDownStyle = ComboBoxStyle.DropDownList };
            List<Room> availableRooms = RoomsDB.Where(r => r.Status == RoomStatus.Available).ToList();
            foreach (Room r in availableRooms) cbRoom.Items.Add(r.RoomNumber + " - " + r.Type);
            if (cbRoom.Items.Count > 0) cbRoom.SelectedIndex = 0;

            Label inLabel = new Label { Text = "Check-In", Location = new Point(390, 20), AutoSize = true };
            DateTimePicker dtIn = new DateTimePicker { Location = new Point(390, 45), Width = 150, Value = DateTime.Today };

            Label outLabel = new Label { Text = "Check-Out", Location = new Point(560, 20), AutoSize = true };
            DateTimePicker dtOut = new DateTimePicker { Location = new Point(560, 45), Width = 150, Value = DateTime.Today.AddDays(1) };

            Button book = new Button {
                Text = "CONFIRM BOOKING",
                Location = new Point(730, 40),
                Size = new Size(180, 45),
                BackColor = cAvailable,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold)
            };
            book.FlatAppearance.BorderSize = 0;

            book.Click += delegate {
                if (GuestsDB.Count == 0 || availableRooms.Count == 0) {
                    MessageBox.Show("No guest or available room found.");
                    return;
                }
                if (dtOut.Value.Date <= dtIn.Value.Date) {
                    MessageBox.Show("Check-Out must be after Check-In.");
                    return;
                }

                Guest guest = GuestsDB[cbGuest.SelectedIndex];
                Room room = availableRooms[cbRoom.SelectedIndex];

                Reservation reservation = new Reservation {
                    BookingID = "BK-" + (8000 + ReservationsDB.Count + 1),
                    GuestProfile = guest,
                    AssignedRoom = room,
                    CheckInDate = dtIn.Value.Date,
                    CheckOutDate = dtOut.Value.Date,
                    Stage = "Reserved"
                };

                room.Status = RoomStatus.Reserved;
                ReservationsDB.Add(reservation);

                MessageBox.Show("Reservation created successfully.\nBooking ID: " + reservation.BookingID);
                ShowReservations();
            };

            bookingPanel.Controls.AddRange(new Control[] { gLabel, cbGuest, rLabel, cbRoom, inLabel, dtIn, outLabel, dtOut, book });

            DataGridView grid = new DataGridView {
                Location = new Point(25, 245),
                Size = new Size(935, 300),
                BackgroundColor = Color.White,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                ReadOnly = true
            };

            grid.Columns.Add("ID", "Booking ID");
            grid.Columns.Add("Guest", "Guest");
            grid.Columns.Add("Room", "Room");
            grid.Columns.Add("Dates", "Stay");
            grid.Columns.Add("Stage", "Status");
            grid.Columns.Add("Total", "Total");

            foreach (Reservation r in ReservationsDB)
            {
                grid.Rows.Add(r.BookingID, r.GuestProfile.FullName, r.AssignedRoom.RoomNumber, r.CheckInDate.ToString("dd/MM/yyyy") + " - " + r.CheckOutDate.ToString("dd/MM/yyyy"), r.Stage, "?" + r.GrandTotal.ToString("N2"));
            }

            contentArea.Controls.AddRange(new Control[] { title, bookingPanel, grid });
        }

        void ShowCheckIn()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Express Guest Check-In", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            ComboBox bookings = new ComboBox { Location = new Point(25, 75), Width = 350, DropDownStyle = ComboBoxStyle.DropDownList };
            List<Reservation> reserved = ReservationsDB.Where(r => r.Stage == "Reserved").ToList();

            foreach (Reservation r in reserved)
            {
                bookings.Items.Add(r.BookingID + " - " + r.GuestProfile.FullName + " - Room " + r.AssignedRoom.RoomNumber);
            }

            if (bookings.Items.Count > 0) bookings.SelectedIndex = 0;

            Button checkIn = new Button {
                Text = "CHECK IN GUEST",
                Location = new Point(400, 70),
                Size = new Size(180, 45),
                BackColor = cSecondary,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            checkIn.FlatAppearance.BorderSize = 0;

            checkIn.Click += delegate {
                if (reserved.Count == 0) {
                    MessageBox.Show("No reservations available for check-in.");
                    return;
                }

                Reservation r = reserved[bookings.SelectedIndex];
                r.Stage = "Checked-In";
                r.AssignedRoom.Status = RoomStatus.Occupied;

                MessageBox.Show("Guest checked in successfully!\nRoom " + r.AssignedRoom.RoomNumber + " is now occupied.");
                ShowCheckIn();
            };

            contentArea.Controls.AddRange(new Control[] { title, bookings, checkIn });
        }

        void ShowBilling()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Billing & Check-Out", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            DataGridView grid = new DataGridView {
                Location = new Point(25, 70),
                Size = new Size(935, 350),
                BackgroundColor = Color.White,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                ReadOnly = true
            };

            grid.Columns.Add("Booking", "Booking ID");
            grid.Columns.Add("Guest", "Guest");
            grid.Columns.Add("Room", "Room");
            grid.Columns.Add("RoomCharge", "Room Charge");
            grid.Columns.Add("Service", "Services");
            grid.Columns.Add("GST", "GST");
            grid.Columns.Add("Total", "Grand Total");
            grid.Columns.Add("Due", "Amount Due");

            foreach (Reservation r in ReservationsDB)
            {
                grid.Rows.Add(r.BookingID, r.GuestProfile.FullName, r.AssignedRoom.RoomNumber, "?" + r.RoomTotal.ToString("N2"), "?" + r.ServiceTotal.ToString("N2"), "?" + r.Tax.ToString("N2"), "?" + r.GrandTotal.ToString("N2"), "?" + r.TotalDue.ToString("N2"));
            }

            contentArea.Controls.AddRange(new Control[] { title, grid });
        }

        void ShowSmartEnergy()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Smart Energy & Guest Rewards", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            ListBox list = new ListBox { Location = new Point(25, 70), Size = new Size(935, 350), Font = new Font("Segoe UI", 11) };

            list.Items.Add("Room 101 - Energy: 4.2 kWh - Water: 120 L - Eco Score: 92%");
            list.Items.Add("Room 102 - Energy: 8.7 kWh - Water: 190 L - Eco Score: 71%");
            list.Items.Add("Room 103 - Energy: 5.1 kWh - Water: 140 L - Eco Score: 88%");
            list.Items.Add("Guest reward threshold: Stay below target consumption");
            list.Items.Add("Reward: Hotel credit for spa, restaurant or services");

            contentArea.Controls.AddRange(new Control[] { title, list });
        }

        void ShowHousekeeping()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Zero-Intrusion Smart Housekeeping", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            ListBox list = new ListBox { Location = new Point(25, 70), Size = new Size(935, 350), Font = new Font("Segoe UI", 11) };

            list.Items.Add("Room 104 - Cleaning in progress");
            list.Items.Add("Room 201 - Available and ready");
            list.Items.Add("Room vacancy monitoring: simulated locally");
            list.Items.Add("If room remains vacant for 20+ minutes: housekeeping dispatch");
            list.Items.Add("No unnecessary door knocking required");

            contentArea.Controls.AddRange(new Control[] { title, list });
        }

        void ShowMaintenance()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Predictive Maintenance Center", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            ListBox list = new ListBox { Location = new Point(25, 70), Size = new Size(935, 350), Font = new Font("Segoe UI", 11) };

            list.Items.Add("Room 105 - Maintenance alert: AC abnormal runtime");
            list.Items.Add("Water system monitoring: normal");
            list.Items.Add("AC runtime analysis: anomaly detection active");
            list.Items.Add("Predictive action: inspect equipment before failure");
            list.Items.Add("Maintenance priority: HIGH");

            contentArea.Controls.AddRange(new Control[] { title, list });
        }

        void ShowAIConcierge()
        {
            contentArea.Controls.Clear();

            Label title = new Label { Text = "Hybrid AI Concierge", Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(25, 20), AutoSize = true };

            TextBox input = new TextBox { Location = new Point(25, 75), Width = 600, Font = new Font("Segoe UI", 12) };

            Button send = new Button {
                Text = "ASK CONCIERGE",
                Location = new Point(650, 70),
                Size = new Size(180, 40),
                BackColor = cSecondary,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            send.FlatAppearance.BorderSize = 0;

            TextBox response = new TextBox {
                Location = new Point(25, 140),
                Size = new Size(805, 220),
                Multiline = true,
                ReadOnly = true,
                Font = new Font("Segoe UI", 11)
            };

            send.Click += delegate {
                string q = input.Text.ToLower();

                if (q.Contains("food") || q.Contains("restaurant")) {
                    response.Text = "AI Concierge:\r\nI can route your request to room service or provide restaurant information.";
                } else if (q.Contains("room service")) {
                    response.Text = "AI Concierge:\r\nYour room service request has been prepared for hotel staff processing.";
                } else if (q.Contains("check out")) {
                    response.Text = "AI Concierge:\r\nPlease visit the Billing & Check-Out module to complete your final payment.";
                } else {
                    response.Text = "AI Concierge:\r\nRequest received locally. The smart hotel system can assist with hotel services, room requests, billing and information.";
                }
            };

            contentArea.Controls.AddRange(new Control[] { title, input, send, response });
        }
    }

    public class LoginForm : Form
    {
        public LoginForm()
        {
            Text = "Smart Hotel Login";
            Size = new Size(430, 360);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            BackColor = Color.FromArgb(30, 41, 59);

            Label title = new Label { Text = "SMART HOTEL", Font = new Font("Segoe UI", 20, FontStyle.Bold), ForeColor = Color.White, Location = new Point(100, 30), AutoSize = true };

            TextBox username = new TextBox { Location = new Point(55, 115), Size = new Size(300, 25), Text = "admin" };
            TextBox password = new TextBox { Location = new Point(55, 185), Size = new Size(300, 25), Text = "admin123", PasswordChar = '*' };

            Button login = new Button {
                Text = "LOGIN",
                Location = new Point(55, 240),
                Size = new Size(300, 42),
                BackColor = Color.FromArgb(37, 99, 235),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10, FontStyle.Bold)
            };
            login.FlatAppearance.BorderSize = 0;

            login.Click += delegate {
                if (username.Text == "admin" && password.Text == "admin123") {
                    Hide();
                    MainWindow main = new MainWindow();
                    main.ShowDialog();
                    Close();
                } else {
                    MessageBox.Show("Invalid username or password.");
                    password.Clear();
                }
            };

            Label userLabel = new Label { Text = "Username", Location = new Point(55, 90), ForeColor = Color.White, AutoSize = true };
            Label passLabel = new Label { Text = "Password", Location = new Point(55, 160), ForeColor = Color.White, AutoSize = true };

            Controls.AddRange(new Control[] { title, userLabel, username, passLabel, password, login });
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LoginForm());
        }
    }
}
