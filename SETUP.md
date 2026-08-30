# Rihasham — External Services Setup

Everything below is **console clicking** — no code. Work through it at your own
pace, collect the outputs listed in "What to hand back" at the bottom, and the
whole lot gets wired into the project in one pass.

Exact values are given wherever a field needs a specific string. Where it says
**leave blank**, leave it blank.

---

## ✅ Already done

- Firebase project `rihasham-restaurant` created
- Web app registered → config wired into `apps/admin/.env.local`
- iOS app registered → `GoogleService-Info.plist` in `apps/mobile/`
- Android app registered → `google-services.json` in `apps/mobile/`
- Phone sign-in enabled (+ test number `+966511111111` / code `123456`)
- Google sign-in enabled (public name `Rihasham`)

---

## 1. Firebase — Blaze upgrade + Storage

Storage requires the pay-as-you-go plan on new projects. Free tier covers
~5 GB stored and 1 GB/day downloads; at this restaurant's volume that's
realistically $0/month.

1. Firebase Console → ⚙️ **Usage and billing** → **Modify plan** → **Blaze**
2. Create/select a Cloud Billing account, add card
3. **Set a budget alert of ~$10/month** when prompted
   ⚠️ An alert *notifies*, it does not *cap* — Google has no hard spending cap.
   This is why the alert matters.
4. **Build → Storage → Get started**
5. Rules: **Start in test mode** (locked down before launch — see §7)
6. Location: **`me-central1`** (Doha, closest to Medina). Fallback: `eur3`.
   ⚠️ **Permanent — cannot be changed later.**

---

## 2. Firebase — re-download both config files

Enabling Google sign-in created OAuth clients that aren't in the copies
currently in the repo (confirmed: `"oauth_client": []` in the Android file).

⚙️ **Project Settings** → scroll to **Your apps**:

- **Rihasham iOS** → download `GoogleService-Info.plist`
  - While here: the **App nickname** field contains stray text
    (`okay it gives me a file called Google Info.`). Clear it, set to
    `Rihasham iOS`, then download.
- **Rihasham Android** → download `google-services.json`

Let both land in `~/Downloads/` — they get picked up from there.

---

## 3. Firebase — service account key (backend)

⚙️ **Project Settings** → **Service accounts** tab → **Generate new private key**
→ confirms a download.

🔒 **This one is a real secret** — unlike the config files above, it grants full
admin access to the project. Don't paste it into chat, don't commit it.
Just say where it downloaded.

---

## 4. Apple Developer — Sign in with Apple

Required by App Store guideline 4.8 because the app offers Google/Facebook login.
Needs a paid Apple Developer account (you have one).

At [developer.apple.com/account](https://developer.apple.com/account) →
**Certificates, Identifiers & Profiles**:

### 4a. App ID
**Identifiers** → find or create `sa.rihasham.app` →
ensure **Sign In with Apple** capability is checked → Save.

### 4b. Services ID
**Identifiers** → **+** → **Services IDs** → Continue
- Description: `Rihasham Sign In`
- Identifier: `sa.rihasham.app.signin`
→ Register.

Then click it → check **Sign In with Apple** → **Configure**:
- Primary App ID: `sa.rihasham.app`
- Domains: `rihasham-restaurant.firebaseapp.com`
- Return URLs: `https://rihasham-restaurant.firebaseapp.com/__/auth/handler`
→ Save → Continue → Save.

### 4c. Key
**Keys** → **+**
- Key Name: `Rihasham Sign In With Apple`
- Check **Sign In with Apple** → **Configure** → Primary App ID `sa.rihasham.app` → Save
→ Continue → Register → **Download** the `.p8` file.

⚠️ **The `.p8` downloads exactly once.** Save it somewhere safe.
Note the **Key ID** shown on that page (10 characters).

### 4d. Team ID
Top-right of the Apple Developer account page — a 10-character code.
Also visible under **Membership details**.

### 4e. Back in Firebase
**Authentication → Sign-in method → Apple** → Enable, then fill:
- Services ID: `sa.rihasham.app.signin`
- Apple Team ID: *(from 4d)*
- Key ID: *(from 4c)*
- Private key: paste the contents of the `.p8` file
→ Save.

---

## 5. Supabase — database hosting

Replaces the local Homebrew Postgres. No code changes — just a connection string.

1. [supabase.com](https://supabase.com) → **New project**
   (existing org is fine — this is separate from GymPack)
2. Name: `rihasham`
3. **Database Password**: generate a strong one and **save it** — it's part of
   the connection string and can't be recovered later, only reset.
4. Region: **Middle East (Bahrain)** `me-south-1` if available, else closest
5. Wait ~2 min for provisioning
6. ⚙️ **Project Settings** → **Database** → **Connection string** → **URI** tab
7. Copy it. Looks like:
   `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`
8. Replace `[YOUR-PASSWORD]` in it with the password from step 3

Note: only Supabase's **Postgres hosting** is being used — not its auth,
not its client SDK. Firebase handles auth; the backend talks to this database
over a plain connection string.

---

## 6. Moyasar — payments

Saudi gateway with native Mada + Visa/Mastercard support.

1. [moyasar.com](https://moyasar.com) → sign up
2. Stay in **test mode** for now (no business verification needed to test)
3. Dashboard → **API Keys** → copy both:
   - **Publishable key** → `pk_test_...` (safe in the app)
   - **Secret key** → `sk_test_...` 🔒 (**server-only — never in the mobile app**)

Live keys need business/CR verification — that's a launch-time step, not now.

---

## 7. Optional / later

- **Facebook login** — needs a Facebook Developer app (App ID + Secret).
  Skippable; adding it later changes nothing else.
- **Android SHA-1** — needed for Google Sign-In on Android *release* builds.
  Generated at first EAS build; not blocking.
- **Storage security rules** — currently test mode. Must be locked down before
  launch (see `firebase-storage.rules` in the repo root).

---

## What to hand back

| Item | From | Notes |
|---|---|---|
| `GoogleService-Info.plist` | §2 | just say it's in Downloads |
| `google-services.json` | §2 | just say it's in Downloads |
| Service account `.json` | §3 | 🔒 file path only — don't paste contents |
| Apple Team ID | §4d | 10 chars |
| Apple Key ID | §4c | 10 chars |
| Apple `.p8` file | §4c | 🔒 file path only |
| Supabase connection string | §5 | 🔒 contains the DB password |
| Moyasar publishable key | §6 | `pk_test_...` |
| Moyasar secret key | §6 | 🔒 `sk_test_...` |

**On secrets:** items marked 🔒 go into `.env` files that are gitignored and
never leave this machine. For those, giving the *file path* is enough — they
can be read from disk rather than pasted into chat.

---

## Then what

Once those are in:
1. Database migrated + seeded on Supabase
2. An owner account created so the admin dashboard can be logged into
3. Full end-to-end test: place an order in the app → watch it appear in the
   live queue → advance its status → verify the chat works both ways
4. After that passes: app icons/splash, then EAS build → TestFlight
