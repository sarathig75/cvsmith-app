# Deploying the CVSmith pilot

A step-by-step guide for putting CVSmith online for a small, invite-only pilot. The setup
runs on **any Linux server with Docker**, so you can change hosting provider later. Only
step 2 differs between providers.

What runs on the server, all inside Docker:
- the website, with automatic HTTPS (Caddy);
- the API;
- the background worker that reads CVs;
- the database (Postgres);
- Redis;
- a nightly database backup.

Never paste keys or passwords into chat, email or the repository. You only type them on the
server, in step 6.

---

## 1. Buy a domain
- [ ] Buy a domain at any registrar (for example Porkbun or Cloudflare). A `.in` is roughly
  $7–8 a year and a `.com` roughly $10–11 a year; check the price at checkout.
- [ ] Decide the address testers will use: the bare domain (`cvsmith.in`) or a subdomain
  (`app.cvsmith.in`). This guide calls it **DOMAIN**.

## 2. Create the server
Pick a server with **Ubuntu 24.04, x86/AMD64, about 4 GB RAM, 2 vCPU**, in a region close to
the testers (for India: Singapore or an Indian region).

**Hetzner (chosen for the pilot):**
- [ ] Create an account at hetzner.com → Cloud → new project.
- [ ] Add your SSH key (Security → SSH keys). On Windows you can create one in PowerShell with
  `ssh-keygen` and paste the contents of `C:\Users\<you>\.ssh\id_ed25519.pub`.
- [ ] Add a server: location **Singapore**, image **Ubuntu 24.04**, an x86 type with about
  4 GB RAM. Check the current price on the order page.
- [ ] Optional: tick **Backups** (whole-server snapshots, about 20% extra).
- [ ] Write down the server's **IPv4 address**.

**Other providers (same steps):** DigitalOcean (Droplet, Bangalore region), AWS Lightsail
(Mumbai), or any VPS with Ubuntu 24.04 and SSH access work the same way. Everything from step 3
on is identical.

## 3. Point the domain at the server
- [ ] At your registrar's DNS settings, add an **A record**: name `@` (or `app` for a
  subdomain), value = the server's IPv4 address.
- [ ] Wait until it works. In PowerShell, `nslookup DOMAIN` should show the server's address.
  This usually takes minutes, but can take up to a few hours.

## 4. Email for login codes (Resend, free plan: 3,000 a month, 100 a day)
- [ ] Create an account at resend.com.
- [ ] Domains → Add domain → enter DOMAIN. Resend shows a few DNS records (SPF/DKIM). Add them
  exactly as shown at your registrar, then click Verify in Resend.
- [ ] API Keys → Create API key (sending access). Keep it for step 6; it is shown only once.

## 5. Google sign-in (optional)
- [ ] Google Cloud console → APIs & Services → Credentials → your OAuth client.
  Add `https://DOMAIN` under **Authorized JavaScript origins**.
- [ ] Keep the client ID for step 6. Skip this step to offer email codes only.

## 6. Install CVSmith on the server
- [ ] Connect from PowerShell: `ssh root@SERVER_IP` (or the user your provider gives you).
- [ ] Get the code:
  ```bash
  apt-get update && apt-get install -y git
  git clone https://github.com/sarathig75/cvsmith-app.git /opt/cvsmith
  cd /opt/cvsmith
  ```
  The repository is private, so git asks for a login. Use your GitHub username and a
  **fine-grained personal access token** with read access to this repository only
  (GitHub → Settings → Developer settings). Don't use your password.
- [ ] Run the setup, once:
  ```bash
  sudo ./deploy/setup.sh
  ```
  It installs Docker, turns on the firewall (SSH, HTTP and HTTPS only) and asks for:
  - DOMAIN;
  - the Resend API key;
  - the Claude API key;
  - optionally the Google client ID.

  It generates the other secrets itself and starts everything. The first start takes a few
  minutes.
- [ ] Open `https://DOMAIN`. You should see the CVSmith start page with a padlock (HTTPS).

## 7. Invite pilot testers
Only invited addresses can log in. Everyone else sees "CVSmith is in private beta".
```bash
cd /opt/cvsmith
sudo ./deploy/dc exec backend python -m app.cli invites add tester1@gmail.com tester2@gmail.com --note "pilot wave 1"
sudo ./deploy/dc exec backend python -m app.cli invites list
sudo ./deploy/dc exec backend python -m app.cli invites remove tester2@gmail.com
```
To make someone Pro for testing:
```bash
sudo ./deploy/dc exec postgres psql -U cvsmith -d cvsmith -c "update users set plan='pro' where lower(email)=lower('tester1@gmail.com')"
```

## Day-to-day
| Task | Command (on the server, in `/opt/cvsmith`) |
|---|---|
| Install the latest version | `sudo ./deploy/update.sh` |
| Is everything running? | `sudo ./deploy/dc ps` |
| See errors | `sudo ./deploy/dc logs --tail 100 backend` (or `worker`, `web`) |
| Restart everything | `sudo ./deploy/dc restart` |
| Change a setting | `sudo nano deploy/.env.prod`, then `sudo ./deploy/dc up -d` |
| Backups | one file per night in `deploy/backups/` (14 days kept) |

**Copy a backup to your computer** (PowerShell):
`scp root@SERVER_IP:/opt/cvsmith/deploy/backups/cvsmith-YYYY-MM-DD.sql.gz .`

**Restore a backup.** This replaces everything in the database with the backup, so first copy
the newest backup somewhere safe:
```bash
sudo ./deploy/dc stop backend worker
sudo ./deploy/dc exec -T postgres psql -U cvsmith -d cvsmith -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c deploy/backups/cvsmith-YYYY-MM-DD.sql.gz | sudo ./deploy/dc exec -T postgres psql -q -U cvsmith -d cvsmith
sudo ./deploy/dc start backend worker
```

**Moving to another host:**
1. Set up the new server with steps 2 and 6.
2. Copy over the latest backup and restore it.
3. Copy `deploy/.env.prod`, so sessions and secrets stay the same.
4. Point the domain's A record at the new IP.

## If something is wrong
- **Site doesn't load / no padlock:** check that DOMAIN points at the server (step 3), and that
  ports 80/443 are open in the provider's firewall too, if it has one. Then
  `sudo ./deploy/dc logs web`.
- **No login email arrives:** check spam; check the domain is "Verified" in Resend;
  `sudo ./deploy/dc logs backend | grep -i smtp`. The free plan stops at 100 emails a day.
- **"Private beta" for a tester:** invite their exact address (step 7).
- **CV not read / PDF fails:** `sudo ./deploy/dc logs worker` / `logs backend`.

## Before inviting real testers
- [ ] **Privacy notice.** Testers upload real CVs: say what is stored (CV content, email), that
  the uploaded file is deleted once read, and how to delete the account (Settings → Danger
  zone). Claude can draft one; please review it yourself, as it is legal text.
- [ ] **Running costs for a 25-person pilot (estimates):**
  - server about $10–25 a month;
  - domain about $10 a year;
  - email free;
  - Claude API about $0.04–0.08 per CV read (estimate) and about $0.013 per suggestion.
- [ ] Payments (Week 10) are not live. Testers can't buy Pro yet; make them Pro by hand if
  needed (step 7).
