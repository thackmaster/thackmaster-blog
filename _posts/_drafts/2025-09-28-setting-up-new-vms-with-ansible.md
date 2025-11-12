---
title: Setting up new VMs with Ansible
description:
author: thackmaster
date: 2025-09-28
last_modified_at:
categories: []
tags: [ansible, vm]
media_subpath:
image:
  path:
  alt: Image from ??? (@???) via Unsplash
---

The day started like normal, a new admin VM needed created and assigned to the user. Easy enough, we have templates for that. At least, that's what I thought. I did eventually solve the issue and -- without going into too much detail -- turned out to have been a simple checkbox I had missed along the way.

This is where my rabbit hole started. While we have templates for our VMs, I thought about all the changes we might make between their iterations. "Why not use an Ansible playbook for setting up these VMs?". How much of it was even possible?

I present to you, part 1 of my journey into setting up new VMs with Ansible.

## Environment
I'm working with some pretty basic hardware, all of it being run on my MacBook Pro running VMware Fusion. While we use Red Hat at my workplace, I opted for Rocky Linux 9.6 for my VMs of choice as the commands and processes are the same, and it's free.

As of writing, Rocky Linux 10 is available, but I had several issues when running these commands with very arbitrary errors. For example, my command to install Docker kept failing for some reason. I was honestly frustrated with it at this point and didn't continue my investigation, so I installed Rocky 9.6 instead.

Once I had Rocky installed (minimal install), I took a snapshot and got to work writing my playbook.

## The Playbook
I created a new directory for my playbook (new-vm) and named the playbook `dnf.yml` as it is intended to be run on DNF based systems (Red Hat, Fedora, Rocky, Alma, etc).

My goal was to automate as much as possible post-installation, assuming that only a root user had been created and that the default settings were not modified during installation.

### Prompts
This playbook has three prompts that are asked immediately after running the playbook: username, password, and hostname. This is done through the `vars_prompt` module of Ansible.

```yml
vars_prompt:
    - name: new_user
      prompt: "Enter the username for the new user to be created. Press Enter to skip."
      private: no
    - name: user_pass
      prompt: "Enter the password for the new user to be created. Press Enter to skip."
      private: yes
    - name: machine_name
      prompt: "Enter the hostname for the new machine (no spaces). Press Enter to skip."
      private: no
```

All of these can be skipped by simply pressing Enter. No username will skip creating a new user, and no hostname will skip changing the hostname. This allows the playbook to be run on machines where one of these parameters may have already been set, and prevents it from interfering with those settings.

Once we set the hostname and create the user, we add the user to the `wheel` group for sudo access. Easy enough.

```yml
- name: Add user to wheel
    command: usermod -aG wheel {{ new_user }}
```

The beautiful thing about Ansible is that you can run the same command a variety of ways. I opted for the `command` since that's the command I use most often, so it made sense to use it in my playbook.

### Authentication
Next, I decided to play a little game called "test your sanity". Luckliy, this ended up being easier than I expected: SSH keys.

I ran into this issue when I spun up a Rocky VM in DigitalOcean and was forced to use an SSH key. I wanted to see if you could 1) generate the SSH key on the control node (or the machine pushing the Ansible commands), and 2) copy that file over to the node (or the machine receiving the Ansible commands). This is all a bunch of words to essentially say "Can I generate SSH keypairs and copy them over to the new VM?"

The short answer is yes. Below is my block that does this. First, I ask if a keypair has already been generated (no use in generating a new one if it already exists). If not, I ask for a name for the keypair then generate the key. I then will read the public key and copy it to the new user's `authorized_keys` file. I then change the permissions to 600 and `chown` it to the new user. Keep in mind, all of this is done if it is wanted, and is skipped if it isn't. Additionally, if an SSH key is used, I disable password authentication for sudo.

It should be noted, the SSH keypair is not generated with a password in this instance.

And of course, I allow for password authentication to be used of an SSH key isn't. This password is set in the `vars_prompt` section.

### Packages
Next, since I plan to use this on remote systems where exposing SSH to the internet is a bit "no-no", I install Tailscale and join it to my network for administration. The playbook askes for a script, which is generated in the Tailscale admin console when you go to add a new machine. It is a one-liner that installs Tailscale and joins it to the network. Makes my job easy.

Then my favorite service comes into play: Docker. I add the Docker repo, enable it, install Docker and its friends, and enable and start the service. Then (since I'm so nice), I add the new user to the `docker` group.

After that, I run a `dnf update` because we know it needs it. After we're up-to-date, I install a few packages I prefer to have on my systems. Those being: `vim`, `net-tools`, and `nfs-utils`. Finally, we clean up our mess and reboot the machine so all those changes are saved in a safe place. While I have command to disable the root user sign-in in the playbook, I opt to disable it manually since the Ansible playbook runs as root. Also, upon rebooting after disabling it, the playbook would error out since it would never get a proper response from the machine since it wouldn't be able to sign in.

## Conclusion
Voila! Relatively simple in nature, of course it's a completely different beast outside of that.

## References
- [Playbook](https://github.com/thackmaster/homelab/blob/main/ansible/playbooks/new-vm/dnf.yml)
