---
title: Update Docker containers with Ansible
description: 
author: thackmaster
date: 2025-08-23
last_modified_at: 2025-09-28
categories: [Docker, Homelab]
tags: [ansible, updates]
media_subpath: /assets/img/update-docker-containers-with-ansible/
image: 
  path: splash.jpeg
  #https://images.unsplash.com/photo-1637778352878-f0b46d574a04
  alt: Image from Mohammad Rahmani (@afgprogrammer) via Unsplash
---

In my previous blog post, I covered how to get started with Ansible and we tested it by updating another machine through Ansible. We're going to take it a step further and expand our knowledge with the tool, by updating a Docker container.

This project seemed deviously simple. Ansible has a ton of community modules that allow you to interact with Docker containers. "Surely, it'll be as simple as referencing the container and saying 'recreate', right?" You'd think I had learned my lesson with my previous endevours to not say something so naive, but dear reader that is where I went terrible astray. Not only did I fail to narrow my target the first go around, but I ended up causing a reboot loop of all of my containers due to a misconfiguration in my playbook. That machine did survive a reboot (and several subsequent ones) and it is happily running several containers.

So where did I end up?

## Deviously simple on the surface
On the surface, this seems like a simple project. Reference the community modules, save the container's config during the run, stop, remove, rebuild the container. Easy, right?

Wrong.

This endeavor I embarked on proved itself to be a fair challenger in testing my sysadmin skills.

After causing a reboot loop of all my containers on one of my hosts (optiplex in case you're curious) and recovering it from that hellscape I had inadvertently unleashed, I knew I had to take it slow.

## Taking it slow
Containers are easy on their own. Ansible is easy on its own. Combining the two was going to take time, learning about how Ansible expects values and how Docker presents them.

I started by simply prompting for the name of the docker container and returning the host's info. Easy enough. Enter my SSH password, hit Enter for the `become` prompt, and enter the container name. Fantastic. A simple test to check that connectivity was established and that Ansible could access the Docker socket on the host.

```yml
vars_prompt:
    - name: "container_name"
      prompt: "Enter the Docker container name to update"
      private: no

tasks:
    - name: Test docker connection
      community.docker.docker_host_info:
```

This worked like a charm on my Debian-based machines. My RedHat one, however, kept failing. My error message didn't do much to help.

```
fatal: [redhat1.lan]: FAILED! => {"can_talk_to_docker": false, "changed": false, "msg": "Error connecting: Error while fetching server API version: Not supported URL scheme http+docker"}
```

Adding the Ansible user to the docker group didn't work, and various other suggestions did not thing to change the error. I decided to leave it for a later time, thinking it was something with SELinux or that host's firewall or file permissions.

> As of publishing, I have not resolved the issue with my RedHat machine.
{: .prompt-info}

Focusing my efforts now on my host "optiplex" running Ubuntu, I was able to get the information back as expected. From there, I then grab the requested container details and save them to the variable "container_info".

```yml
- name: Get details of container
    community.docker.docker_container_info:
        name: "{{ container_name }}"
    register: container_info
    failed_when: false
    changed_when: false
```

Writing in a quick debug statement, I was able to verify that it was getting all of the requested information from the container.

```yml
- name: Debug container
    debug:
        var: container_name
```

I wrote these several times throughout development of this playbook but I did remove some since they weren't necessary during normal runs. For example, debugging `container_info` like you see here results in a very long wall of text. You can see exactly what it was outputting by going to any Docker container and using the `inspect` command against it; those were the values I was being returned.

Of course, we have to fail this if we don't return a container so that the playbook stops trying against that particular host. Perhaps we typed the name wrong, named it differently on that host, or it simply doesn't exist on that host.

```yml
- name: Fail if container doesn't exist
    fail:
        msg: "Container '{{container_name}}' not found on host {{ inventory_hostname}}"
    when: container_info is not defined or
            container_info.container is not defined or
            container_info.container is none
```

Now that I had the container information saved, I could really get to work. This next part was by far the trickiest.

## Dictionaries, arrays, lists, and strings
### Restart policy
Next, I broke apart the `container_info` variable I had captured to help my refinement in recreating the container. Up first was the restart policy. This was relatively easy since Docker returns the value as a string and expects a string when starting the container.

```yml
- name: Set restart policy
    set_fact:
        restart: "{{ container_info.container.HostConfig.RestartPolicy.Name }}"
```

Then I output it as part of my debugging (I still do this when running it on multiple hosts so it's easier to pick out misconfigurations that might have slipped through previously).

```yml
- name: Show restart policy
    debug:
        var: restart
```
{: file='playbook'}

```
ok: [optiplex.lan] => {
    "restart": "unless-stopped"
}
```
{: file='output'}

### Ports
Up next was ports. This was going to be a bit more difficult since they aren't exactly output in a way that they can just be written to a variable for later use. Instead, I was going to have to engineer this some type of way.

Luckily we can extract the variables relatively easy by just knowing where they are. Looking at the `docker inspect` for this container, we can clearly see how the data is structured:

```json
"PortBindings": {
    "8000/tcp": [
        {
          "HostIp": "0.0.0.0",
          "HostPort": "8000/tcp"
        }
    ],
    "9443/tcp": [
        {
          "HostIp": "0.0.0.0",
          "HostPort": "9443/tcp"
        }
    ]
}
```

This gave me a great idea. What if we took the key (the default port the container expects to listen on) and mapped it back to the HostPort? I confirmed my suspicions with another container that I had mapped to a different port from the default.

```json
"PortBindings": {
    "8090/tcp": [
        {
          "HostIp": "",
          "HostPort": "38090"
        }
    ]
}
```

I had to be careful though. I needed to take the "HostPort" and map it back to the key and not reverse it (I did but luckily it just resulted in my container not loading the web interface).

So how did I do it? I used some fun methods that Ansible has built in for building arrays and dictionaries. Here's my command:

{% raw %}
```yml
- name: Set published ports
    set_fact:
        ports: >-
            {{
              container_info.container.HostConfig.PortBindings
              | dict2items
              | map(attribute='value')
              | map('first')
              | map(attribute='HostPort')
              | zip(
                    container_info.container.HostConfig.PortBindings
                    | dict2items
                    | map(attribute='key')
              )
              | map('join', ':')
              | list
            }}
```
{: file='playbook'}
{% endraw %}

```yml
ok: [optiplex.lan] => {
    "ports": [
        "38090:8090/tcp"
    ]
}
```
{: file='output'}

Simply put, we're accessing the items and converting them to a list, taking the "HostPort" binding (the one that is exposed and you use to access the container through, in my case, 38090) and we're relating it back to the "key" (8090). We do this for every entry in the list and we join them together with a `:`, what Docker expects when mapping ports. Then we're combining with `zip` and saving it to the variable "ports".

> If you specify `.../tcp` or `.../udp`, it carries over. I did not specify it here during creation, so it carries over... well, nothing.
{: .prompt-info}

### Volumes and Bind Mounts
I've still got a ways to go and I did so by looking at volumes next. Looking at running containers, it can be discovered that the volumes and bind mounts are stored neatly within the "Mounts" section. Great! They even map the same way, using `Source` and `Destination`. Fantastic. Except for one key difference: the "Name".

```json
{
    "Type": "volume",
    "Name": "d51ab6f877f96ba2fc1070f9b69ba3f399c85e6f7c00f31abb92a3ba9dc4be70",
    "Source": "/var/snap/docker/common/var-lib-docker/volumes/d51ab6f877f96ba2fc1070f9b69ba3f399c85e6f7c00f31abb92a3ba9dc4be70/_data",
    "Destination": "/data",
    "Driver": "local",
    "Mode": "",
    "RW": true,
    "Propagation": ""
}
```
{: file='volume'}

```json
{
    "Type": "bind",
    "Source": "/mnt/media/Photos/thumbs",
    "Destination": "/usr/src/app/upload/thumbs",
    "Mode": "rw",
    "RW": true,
    "Propagation": "rprivate"
}
```
{: file='bind mount'}

Volumes require the "Name" property while bind mounts do not. This meant I needed to treat them differently based on which was which.

This meant I was going to be writing another function to pieces these together.

First, I started with Volumes. Using the function I had written for [Ports](#ports), I copied it with some tweaks.

{% raw %}
```yml
- name: Set named volumes
    set_fact:
        named_volumes: >-
            {{
              container_info.container.Mounts
              | selectattr('Type', 'equalto', 'volume')
              | map(attribute='Name')
              | zip(
                  container_info.container.Mounts
                  | selectattr('Type', 'equalto', 'volume')
                  | map(attribute='Destination')
              )
              | map('join', ':')
              | list
            }}
```
{: file='playbook'}
{% endraw %}

```
ok: [optiplex.lan] => {
    "named_volumes": [
        "portainer_data:/data"
    ]
}
```
{: file='output'}

Knowing that Docker volumes are mapped in `name:destination` format, I go through everything in "Mounts" and find everything with type "volume". Then, we take the volume name and map it to the destination already configured. Similar to [Ports](#ports), this is done in list format.

That's one half of the puzzle. Now I needed to do the same thing for bind mounts. Luckily, since I'd already done the hard part with volumes, it just needed a few tweaks to be able to target bind mounts.

{% raw %}
```yml
- name: Set bind volumes
    set_fact:
        bind_mounts: >-
            {{
              container_info.container.Mounts
              | selectattr('Type', 'equalto', 'bind')
              | map(attribute='Source')
              | zip(
                container_info.container.Mounts
                | selectattr('Type', 'equalto', 'bind')
                | map(attribute='Destination')
              )
              | map('join', ':')
              | list
            }}
```
{: file='playbook'}
{% endraw %}

```
ok: [optiplex.lan] => {
    "bind_mounts": [
        "/var/run/docker.sock:/var/run/docker.sock"
    ]
}
```
{: file='output'}

Beautiful! Now I needed to combine these two variables together to create one cohesive "volumes" entry for my Docker container. Ansible allows for this natively with a simple `+`.

{% raw %}
```yml
- name: Combine volumes
    set_fact:
        combined_volumes: "{{ bind_mounts + named_volumes }}"
```
{: file='playbook'}
{% endraw %}

```
ok: [optiplex.lan] => {
    "combined_volumes": [
        "/var/run/docker.sock:/var/run/docker.sock",
        "portainer_data:/data"
    ]
}
```
{: file='output'}

Woohoo! At this point I thought I was done. This is, until I went to update my cloudflared containers with this command and all of them succeeded in recreating but not being functional.

Some containers require specific startup commands, known as `container args` and `entrypoint`. These essentially tell the Docker daemon what command it needs to run to start the container and how and where to enter the container. Cloudflared is one of those containers as the image is very basic and generic with specific commands and arguments provided during startup that tell it what its secret keys are to connect to the Cloudflare network and provide the Cloudflare Tunnels feature I use. Luckily both of these are strings that can be extracted and input with relative ease.

{% raw %}
```yml
- name: Set command args
    set_fact:
        container_args: "{{ container_info.container.Config.Cmd | default([]) }}"
```
{: file='playbook'}
{% endraw %}

```
ok: [optiplex.lan] => {
    "container_args": [
        "tunnel",
        "--no-autoupdate",
        "run",
        "--token",
        "abcdefghijklmnopqrstuvwxyz1234567890"
    ]
}
```
{: file='output'}

I added in the `default` argument at the end in the chance that a container doesn't have any, as it will then write in the default commands that come with the container. This same thing was done for `entrypoint`, with the exception of the `default` entry that was adjusted to `default(omit)` to completely remove it if there isn't anything listed.

## Recreate the image
From here, everything was pretty straightforward! Pull down the container, stop the existing one, remove it, and recreate the container. That last one was where all of those variables I had been creating would come into play. Now, I'm well aware I could wrap some of these directly into the recreate command, but I chose not to for organizational sake. I prefer that the variables be created prior to any action on the container.

{% raw %}
```yml
- name: Recreate the container
    community.docker.docker_container:
        name: "{{ container_name }}"
        image: "{{ container_info.container.Config.Image }}"
        restart_policy: "{{ restart }}"
        published_ports: "{{ ports }}"
        volumes: "{{ combined_volumes }}"
        command: "{{ container_args }}"
        entrypoint: "{{ container_entrypoint }}"
        recreate: yes
        state: started
    vars:
        ansible_python_interpreter: "/usr/bin/python3"
```
{% endraw %}

`ansible_python_interpreter` simply forces a specific interpreter for python during this command. It helps remove any invariability that might occur due to Python being installed in an unexpected location.

## Conclusion
And there you have it! While this may not be the best practice way to orchestrate container updates, it definitely simplifies the update process if you have multiple hosts running the same container (cloudflared, portainer, etc). I always try to publish the files I use, which you can find on my GitHub profile or below in the [References](#references) section.

---

## Updates (28 Sept 2025)
I've made several changes to the playbook that this article was written about, and while it still holds up true, there are some additional pieces that were added in after testing it on a few other Docker containers and breaking them in the process.

### Error handling
First, I added in some error handling and made the script a bit more dynamic so that it can be used against any container. This is done through the `container_name` variable that is asked to the user before any additional information is gathered. It's relatively lightweight but doesn't hurt.

{% raw %}
```yml
 - name: Fail if the container doesn't exist
      fail:
        msg: "Container '{{ container_name }}' not found on host {{ inventory_hostname }}"
      when: container_info is not defined or
            container_info.container is not defined or
            container_info.container is none
```
{% endraw %}

### Environment variables
Previously, I failed to capture any environment variables about the container. This did cause several issues when I was testing it. I capture the generic environment variables through the `container_info.container.Config.Env` function and store it for the docker create command with the simple `env: "{{ env_vars }}"`

I do this same sort of concept for "network_mode", "command_args", and "entrypoint" (one you wouldn't think about until docker containers start failing randomly when running the playbook). There is a little bit of jazz with these later ones since they aren't always set, using the `default([])` function. I did have to use `default(omit)` for entrypoint since it doesn't like an empty string. But that's the fun of the little quirks from Docker.

All of this was updated in the playbook referenced below.

## References
- [More about `dict2items`](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/dict2items_filter.html)
- [More about `zip`](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/zip_filter.html)
- [Playbook](https://github.com/thackmaster/homelab/blob/main/ansible/playbooks/update-docker-image.yml)
