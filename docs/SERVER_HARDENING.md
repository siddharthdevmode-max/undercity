# 🔒 Undercity Server Hardening Guide

Run these steps on a fresh Ubuntu 22.04 LTS **server** — NOT your local Mac.
Connect via SSH first: ssh user@your-server-ip

## Step 1 — System Update
Run on the server:
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y ufw fail2ban unattended-upgrades curl git

## Step 2 — Firewall (UFW)
Run on the server:
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw deny 5000/tcp
    sudo ufw deny 5432/tcp
    sudo ufw deny 6379/tcp
    sudo ufw --force enable
    sudo ufw status verbose

## Step 3 — Fail2ban
Run on the server:
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    sudo fail2ban-client status

## Step 4 — SSH Hardening
Add your SSH public key first from your LOCAL Mac:
    ssh-copy-id user@your-server-ip

Then on the server:
    sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
    sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
    sudo systemctl reload sshd
    # Always test SSH in a NEW terminal before closing current session

## Step 5 — Auto Security Updates
Run on the server:
    echo 'APT::Periodic::Update-Package-Lists "1";' | sudo tee /etc/apt/apt.conf.d/20auto-upgrades
    echo 'APT::Periodic::Unattended-Upgrade "1";'   | sudo tee -a /etc/apt/apt.conf.d/20auto-upgrades

## Step 6 — Verify
Run on the server:
    sudo ufw status
    sudo fail2ban-client status
    sudo sshd -T | grep -E "permitrootlogin|passwordauthentication"
    ss -tlnp | grep -E '5000|5432|6379'

## Final Checklist Before Launch
- [ ] UFW enabled and configured
- [ ] Fail2ban running
- [ ] Root SSH login disabled
- [ ] Password SSH auth disabled (key only)
- [ ] Auto security updates enabled
- [ ] Ports 5000, 5432, 6379 NOT exposed to internet
- [ ] Cloudflare proxy ON (orange cloud) on all DNS records
- [ ] TLS certificate valid and auto-renewing
- [ ] Docker containers run as non-root user (already in Dockerfile)
