# 💈 JMbarber — Barbershop Booking System

> Progressive Web App (PWA) built for a real barbershop client to replace manual appointment scheduling.
> PWA de reservas desarrollada para una barbería real: los clientes agendan solos y el barbero administra su agenda.

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![OneSignal](https://img.shields.io/badge/Push-OneSignal-E54B4D?style=flat-square)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)

## 🧩 The problem
The barbershop handled every appointment by hand through chat messages, which caused double bookings, lost time answering messages and no clear view of the daily agenda.

## ✅ The solution
- **Online booking** — customers pick an available slot and book on their own.
- **Client accounts** — sign-up and login for returning customers.
- **Admin panel** — the barber manages the agenda, working hours per day and blocked slots.
- **VIP schedules** — special hours and exceptions for VIP clients.
- **Push notifications & reminders** — automatic appointment reminders via OneSignal and web push.
- **Installable PWA** — works like a native app on Android and iPhone.

## 🏗️ Architecture
```
Frontend (HTML/CSS/JS, PWA)
        │
        ▼
Supabase ── PostgreSQL (appointments, schedules, users, notifications)
   │
   └─ Edge Functions: send-notifications, process-reminders
        ▲
GitHub Actions: deploy to GitHub Pages + scheduled reminder job
```

**Database tables:** `client_users`, `appointments`, `day_schedules`, `blocked_slots`, `vip_schedules`, `vip_exceptions`, `push_subscriptions`, `notification_log`.

## 📁 Project structure
| File | Purpose |
|---|---|
| `booking.html / booking.js` | Customer booking flow |
| `admin.html / admin.js` | Barber's admin panel |
| `auth.js`, `login.html` | Authentication |
| `push.js`, `notify.js`, `OneSignalSDKWorker.js` | Push notifications |
| `supabase-schema.sql`, `supabase-migration-v*.sql` | Database schema and migrations |
| `supabase/functions/` | Edge functions for notifications and reminders |
| `.github/workflows/` | Deployment and scheduled reminders |

## 🚀 Run locally
1. Create a Supabase project and run `supabase-schema.sql`, then the migrations in order.
2. Put your Supabase URL and anon key in `supabase-config.js`.
3. Serve the folder with any static server (for example `npx serve .`) and open `booking.html`.

## 👤 Author
**Brayan Muñoz** — Systems Engineer · [LinkedIn](https://www.linkedin.com/in/brayan-de-jesus-mu%C3%B1oz-acu%C3%B1a-335444349/)

Designed, built, deployed and maintained end to end for the client: requirements, data model, development, testing, training and ongoing support.
