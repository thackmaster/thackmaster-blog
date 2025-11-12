---
title: How to upgrade Postgres
description: Databases are scary. Updating them should be a straightfoward process. Here's the walkthrough in doing so.
author: thackmaster
date: 2025-11-02
last_modified_at:
categories: []
tags: []
media_subpath: /assets/img/how-to-upgrade-postgres/
image:
  path: splash.jpg
  #https://unsplash.com/photos/black-and-silver-turntable-on-brown-wooden-table-GNyjCePVRs8
  alt: Image from Benjamin Lehman (@abject) via Unsplash
---

> This article is primarily written for OS installations, but the same principal steps can be applied to Docker-based installations with a few tweaks. For most homelab users, this won’t be necessary as the maintainer of your installed services will usually provide step-by-step instructions or will write a data migration process that executes when running the new version for the first time.
> 
> Check the release notes of your installation method for more throughout information. 
{: .prompt-info}

Databases: so powerful and so scary. Yet over the last several months, I’ve come to quite like databases, specifically PostgreSQL. Powering much of the world’s infrastructure and services alongside MySQL (and by extension MariaDB), it’s easy to see why the open-source solution is so heavily utilized. It runs on pretty much anything, supports replication natively, is easily navigated, and can scale to massive sizes without losing its cool.

In recent months, I was able to take a temporary position focusing on another vein of system administration: Red Hat. I've never dealt with Linux thus far in my career as I work in a 99% Windows-based workcenter. My only experience with Linux up to this point was my homelab, and that was only with Debian. It was a fun time and a really cool experience that I'm forever grateful I was able to have.

> In the next paragraph, I talk about "standard" and "non-standard" Postgres versions. This refers to whether the installation came from the Postgres Red Hat repository (standard) or not (non-standard).
{: .prompt-info}

After some poking around, I was able to find some isolated instances of Postgres running older versions. One service was using Postgres 10, another running a non-standard version of Postgres 14. At the time, Postgres 17 was the latest version to upgrade to. Finding these was oddly exciting for me; I received approval then got to work testing various update methods for these databases. Very early on, I was greeted with a choice: should I dump the database contents and jump major versions (I chose to go to 16 with all of these installations, so I jumping to 16 from an end-of-life Postgres 10 and a non-standard Postgres 14), or do an in-place upgrade and gradually step up to 16. In hindsight, I took the route that forced me to learn both methods but I didn't know that and while it takes longer to upgrade iteratively, my thought process was that I could avoid data loss altogether by doing it that way (which is not true, you can lose data either way; always have backups).

I'll cover both methods.

## Upgrade in-place
This process is relatively simple *if* you know about the nice modules provided to help facilitate these upgrades, and that you have a Red Hat version of Postgres already installed.

> When taking this route, only upgrade from major version to major version (12 to 13, 13 to 14, etc).
{: .prompt-tip}

> You'll want to make notes of any config adjustments that have been made to the installation as this method will erase those adjustments.
{: .prompt-warning}

1. Stop PostgreSQL
```bash
systemctl stop postgresql
```

2. Reset the DNF module for Postgres
```bash
dnf module reset postgresql:<old-version>/server
```

3. Install the new Postgres version
```bash
dnf module install postgresql:<new-version>/server
```

4. Install the `postgresql-upgrade` package
```bash
dnf install postgresql-upgrade
```

5. Run the upgrade tool
```bash
postgresql-setup --upgrade
```

    > The next step depends entirely on your authentication method. Since this database was authenticating locally, it wasn't able to use an identity provider like the default configuration expects. If you **are not** using an identity provider to autheticate your database to your application, execute the next step. If not, **skip it**.
    >
    > If you are not sure, **skip the step**. You'll know this is the issue if your application doesn't properly start and the Postgres logs return the line `FATAL:  Ident authentication failed for user "database_username".`
    {: .prompt-warning}

6. Change the authentication method

    ```diff
    # IPv4 local connections:
    - host    all             all             127.0.0.1/32            ident
    + host    all             all             127.0.0.1/32            md5
    # IPv6 local connections:
    - host    all             all             ::1/128                 ident
    + host    all             all             ::1/128                 md5
    ```
    {: file='pg_hba.conf'}

7. Start Postgres
```bash
systemctl start postgresql
```

8. Reindex the database (this is overall good practice, especially after an upgrade)
```bash
sudo -i -u postgres psql -d database_name -c "REINDEX DATABASE database_name;"
```

9. Verify the upgraded version
```bash
psql --version
```

## Upgrade via dump and import
