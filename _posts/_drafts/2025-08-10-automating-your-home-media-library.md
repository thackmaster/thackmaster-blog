---
title: Media Orchestration with Docker Swarm
description: Bare-metal Debian running a fully orchestrated home media stack, a technical breakdown of creating a self-healing media stack
author: thackmaster
date: 2026-05-26
last_modified_at: 2026-05-26
categories: []
tags: [homelab, automation, media, plex, jellyfin, emby, docker, swarm]
media_subpath: /assets/img/automating-your-home-media-library
image:
  path: splash.avif
  alt: Image from Glenn Carstens-Peters (@glenncarstenspeters) via Unsplash
---

Since beginning my homelab journey, I've been trying to explore more options for making my servers more "agile" in a sense, where if one goes down or I add a new one that services and management can magically scale to include or no longer include that server. I've played with it on a few services but never got around to actually including my media orchestration stack. Until now.

Some may question "Why not Kubernetes?" The answer is simple: because I didn't want to. I am familar and comfortable with Docker and I'm not running the next Netflix here, so why not try out Swarm? It's a Docker feature that I haven't seen used in the wild very frequently. So I took a shot in the dark and guess what, it paid off.

When I first started my homelab, every node was independently managed and talked to a common storage source. Today, all of my nodes operate as workers in my Swarm (with managers, of course) and for the most part, operate completely independently of each other. I use GitHub to store my configuration files (with environment variables substituted through variables) and Portainer to manage my stack. In this post, I'll deep-dive into how I got this stack to work. There's definetely some duct tape holding it together but for my purposes, it works quite well. And yes, I've included my compose file that makes this all possible.

## The Stack
- **Hardware:** 1 Optiplex (Small Form Factor), 2 HP ProDesk (Micro Form Factor), 1 Raspberry Pi 5, 1 Synology NAS (18TB)
- **OS:** Debian 13 (Minimal)
- **Orchestration:** Docker Swarm feat. Portainer
- **Storage:** Local Storage with NFS Mounts
- **Source:** [https://github.com/thackmaster/homelab/blob/main/arr/docker-compose.yml](https://github.com/thackmaster/homelab/blob/main/arr/docker-compose.yml)






1. Introduction: Why Docker Swarm for a Media Server?
  - The Hook: Introduce your ultimate, hands-off media empire.
  - The "Why": Briefly explain why you chose Docker Swarm over standalone Docker Compose or Kubernetes (e.g., native clustering, low overhead, simpler than K8s, high availability).
  - The Goal: What will the reader learn? (How to orchestrate a multi-node, automated media stack using Portainer).
2. The Foundation: Hardware & OS Minimalisms
  - Keep this section brief but informative since your focus is the software.
  - The Bare Metal: Mention your Dell Optiplex cluster (efficient, cheap, powerful enough for transcoding).
  - The OS: Why Debian Minimal? (Rock-solid stability, zero bloat, perfect for container hosts).
  - Tip: Use a quick markdown table for your specs so readers can digest it instantly.
3. Architecture: The Multi-Node Swarm & Storage Strategy
  - Swarm Setup: Mention how many nodes you have (e.g., 1 Manager, X Workers).
  - The Storage Challenge: Crucial Sub-section. In a Swarm, containers can drift between nodes. How do Sonarr/Radarr access the same media library and /config files?
  - Briefly explain your solution (e.g., NFS share, GlusterFS, or Ceph) because readers will immediately ask about this.
4. Orchestration with Portainer: The Command Center
  - Why Portainer? Validate your preference—it gives you a beautiful visual representation of your Swarm, easy log viewing, and stack management without fighting the CLI 24/7.
  - Stacks Feature: Explain how Portainer handles Docker Compose files as "Stacks" deployed directly to the Swarm cluster.
5. The Automation Stack (The Core)
  - This is the meat of your post. Group your tools by function and explain their Swarm configurations.
  - The Directors (Sonarr & Radarr): * How they talk to each other.
  - Swarm Specifics: Placement constraints (e.g., forcing them to run on nodes with specific storage mounts or hardware transcoding capabilities if using QuickSync).
  - The Muscle (Download Clients): * Sabnzbd/Deluge/Transmission.
  - How they handle data passing back to Radarr/Sonarr across the network overlay.
  - The Presenter (Plex/Jellyfin): * How you handle streaming traffic into the Swarm.
6. Configuration Secrets & Swarm Gotchas
  - Share the hard-earned wisdom that makes a blog post truly valuable.
  - Network Overlays: How the containers communicate securely across nodes using Docker's overlay network.
  - Volume Binding vs. Cluster Volumes: Tips on preventing database corruption (especially with SQLite used by Sonarr/Radarr over network shares).
  - Updates: How easy it is to update a image in Portainer with a single click without tearing down the whole media server.
7. Conclusion & Next Steps
  - Wrap up with how stable the system is now that it's automated.
  - Call to action: Ask readers what their preferred orchestration tool is, or what they use for shared storage.





This guide will go into deep detail on setting up your home media server, making a publically available request site, setting up media management services, and keeping everything saved nice and neat within Docker Swarm.

First, it's important to choose what media server you're going to use. I personally use Plex but you may also use Emby (close-sourced, polished and better supported), Jellyfin (open-source fork of Emby), or one not listed here. Ultimately, the server itself is going to be how you (and your users, if you choose) access the media.

## Server
### Hardware
Your media server doesn't have to be a massive server, most users utlimately end up using a Dell Optiplex or a Lenovo ThinkCentre computer. You can choose any chassis size, I personally settled on a Dell Optiplex 5050 SFF for my server as it's bigger than the Micro form factor variants and allows for better airflow for the CPU. I picked up the computer at a local E-Recycling place. Its CPU isn't the most powerful (an Intel Core i5-7500 @ 3.40GHz) but it has enough kick to cover the few transcoding tasks that occassionally come in from users (partly due to how I store my media but we'll cover that later). It has 16GB of RAM and I've never come close to feeling pressured by that.

In addition to the server hardware, I also have a Synology NAS (pre-Synology being terrible) that stores all the media on it.

### Software
The Optiplex came preinstalled with Windows 11 but I wiped that and installed Debian on it, keeping with the minimal installation meaning it has no GUI. However, I don't need a GUI on the server as I'll be accessing it over SSH and managing containers through Portainer. Once I had Debian installed, I verified I could SSH into it from my laptop, then moved it into my rack. From there, I configured my router to give it a static IP of my choosing, plugged it into my switch, and powered it on. From my laptop, I verified it had turned on and could be SSH'd into.

I don't use SSH keys within my homelab as it's not necessary for my setup so I won't be covering that here.

## Install Time
First, I needed to install [Docker](https://docs.docker.com/engine/install/debian/) to run everything. It is easiest to [install from the apt respository](https://docs.docker.com/engine/install/debian/#install-using-the-repository). Don't forget to enable Docker to start automatically on boot using `systemctl enable docker`.

Now that we have Docker running, it's time to get into the fun of it all. From here, I'll be showing how I've done it with Docker Swarm.

## Swarming it up
Within my homelab, I have 4 total servers: A Raspberry Pi 5 (my main Swarm controller), two HP ProDesk's, and my Dell Optiplex. If you're not at all familar with Swarm, let me briefly describe it.

Docker Swarm takes the idea of virtualization and containers and adds in high-availability. So if I have three containers running on one of my ProDesk's when it reboots (probably from me updating it), the controller will immediately see that that node has gone offline and will move the three containers running on that host to another host that has capacity within the group I've created, called a "Swarm". It's an interesting concept I want to write about in the future. For now, simply understanding this basic principle will accomplish my main points.

Once I add Optiplex to my Swarm, it's ready to go. There's nothing else I need to do on the host itself so I swap over to my controller which is running Portainer. It's a personal preference for managing my Swarm.

Now we'll get to writing our compose file for the Swarm. This took me a while to figure out how to properly maintain performance while also making sure that data was backed up. You might think that storing the config directory for Sonarr and Radarr on the NAS would be the optimal idea, and you would initially be correct. That is, until you go to use it and it is slow as hell. Come to find out, Sonarr and Radarr don't use a traditional database, rather a single file that operates as a lightweight database known as SQLite. Pretty self explanatory. SQLite has a known issue with being on remote mounts like a NAS that causes it to suffer from lockfile errors and overall poor performance. So the solution is to keep the SQLite database local on the machine. But we need to keep it redundant in case we lose the host or the storage drive. The intent with this can be accomplished by mounting the backup directory where these apps automatically create backups to and mount that specific directory to our NAS while the rest of the application interacts with the config directory locally.




