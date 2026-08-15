---
# the default layout is 'page'
icon: fas fa-info-circle
order: 4
---

## About the site
From homelab to enterprise, SaaS & IaaS to bare-metal, and everything in-between, this blog explores the wonders of hosting your own services, allowing others to use those services securely, and other odds and ends that come with the sysadmin journey.

-----

## Resources
Site generator: [Jekyll](https://jekyllrb.com) (using the [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) theme)

## My Setup
My homelab isn't the most glamorous, but it gets the job done, which is ultimately what matters. A lot of my hardware was rescued or bought from my local community. Let's go over what all is there.

### Compute
- 2 HP EliteDesk 800 G2 (repurposed from a local school district)
    - Intel Core i5-6400T @ 2.2 GHz, 16GB RAM, 256GB SSD
    - Intel Core i5-6600T @ 2.7 GHz, 8GB RAM, 256GB SSD
- 1 Raspberry Pi 5B: 4GB RAM, 32GB SD Card
- 1 Dell Optiplex 5050: Intel Core i5-7500 @ 3.4 GHz, 16GB RAM, 256GB SSD

Everything in my lab runs Debian 13, with the exception of one of the HPs which runs Debian 12 (I haven't gotten around to updating it).

### Storage
- Synology NAS DS920+
    - Intel Celeron J4125, 8GB RAM, 2 14TB drives in SHR, 2 4TB drives in RAID1

Pretty much everything within the homelab is stored on my NAS with nightly backups to Backblaze B2.

### Networking
- UniFi Dream Router
- UniFi Switch - Standard PoE 24
- 2 UniFi Flex Mini's (desk and entertainment areas)

### Containers
Below is an extensive list of what I host within my homelab. This may not be 100% up-to-date at any given time since it's not well documented (I'm working on it). Almost everything runs in Docker, and I stored my compose files in a [publicly accessible GitHub](https://github.com/thackmaster/homelab). You can find it on my GitHub page.

- [Beszel](https://beszel.dev)
- [Bookstack](https://bookstackapp.com)
- [Caddy](https://caddyserver.com/)
- [Caddy Docker Proxy](https://github.com/lucaslorentz/caddy-docker-proxy)
- [DIUN](https://crazymax.dev/diun/)
- [Fail2Ban](https://github.com/fail2ban/fail2ban)
- [Gitea](https://gitea.com)
- [Gitea Runner](https://gitea.com/gitea/runner)
- [Gluetun](https://github.com/qdm12/gluetun)
- [HomeBox](https://homebox.software/en/)
- [LLDAP](https://lldap.com/)
- [Planka](https://planka.app)
- [Plex](https://plex.tv)
- [Portainer](https://www.portainer.io)
- [Prowlarr](https://prowlarr.com)
- [qBittorrent](https://www.qbittorrent.org)
- [Radarr](https://radarr.video)
- [SABnzbd](https://sabnzbd.org)
- [Seerr](https://seerr.dev)
- [Smokeping](https://oss.oetiker.ch/smokeping/)
- [Sonarr](https://sonarr.tv)
- [Tautulli](https://tautulli.com)
- [TinyAuth](https://tinyauth.app/)
