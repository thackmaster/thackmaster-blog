---
title: How to upgrade Postgres
description: Databases are scary. Updating them should be a straightfoward process. Here's the walkthrough in doing so.
author: thackmaster
date: 2025-11-12
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

    > The next step depends entirely on your authentication method. Since this database was authenticating locally, it wasn't able to use an identity provider like the default configuration expects. If you **are not** using an identity provider to autheticate your database to your application, execute the next step. If you are, **skip it**.
    >
    > If you are not sure, **skip the step**. You'll know this is the issue if your application doesn't properly start and the Postgres logs return the line `FATAL:  Ident authentication failed for user "database_username"`.
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
    {: file='/var/lib/pgsql/data/pg_hba.conf'}

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
This section assumes that your postgres user is named "postgres" and that it owns the database installation and its respective files. You may change this based on what your installation uses.

You may choose to execute either to execute the commands below as root or as the postgres user, when appropriate. Take note of the account you will be executing these commands from (root or postgres) and keep it consistent.

To reiterate, the commands below take advantage of DNF modules since we are using Red Hat. You may have to alter some of the commands to fit your installation.

1. Sign into your database host as the root user or with a user account with root privileges.
2. (Optional) Switch to the postgres user.

    > If you decide not to switch to the postgres user, you MUST run the "as root" commands below.
    {: .prompt-tip}

3. Take note of the name and owner of the database you're dumping
    ```bash
    ### AS USER "POSTGRES"
    psql -c '\l'

    ### AS ROOT
    sudo -i -u postgres bash -c "psql -c '\l'"
    ```

    ![alt text](postgres-list.png)

4. Create the `dump.sql` file (replace `dump_db` with the name of the database from the step above).
    ```bash
    ### AS USER "POSTGRES"
    pg_dump db_name > dump.sql

    ### AS ROOT
    sudo -i -u postgres bash -c "pg_dump db_name > dump.sql"
    ```

5. Exit to root if you swapped to the postgres user.
6. Stop the old Postgres version
    ```bash
    systemctl stop postgresql-14
    ```

7. Install the new Postgres version
   ```bash
   dnf module install postgresql:15/server -y
   ```

8. Remove the old Postgres versionm data (since it was created with a different database schema, it will need to be fully recreated, which is why we dumped it)
   ```bash
   rm -rf /var/lib/pgsql/14 /var/lib/pgsql/data
   ```

9.  Uninstall the old Postgres version
    ```bash
    dnf remove postgresql14
    ```

10. Initialize the new database
    ```bash
    postgresql-setup --initdb
    ```

11. Start the new Postgres version
    ```bash
    systemctl start postgresql
    ```

12. If needed, modify the `/var/lib/pgsql/data/pg_hba.conf` file. This will need to be done if you are NOT using `ident` as the authentication provider for your database. If you are unsure, you'll most likely need to make these modifications.

    ```diff
    # IPv4 local connections:
    - host    all             all             127.0.0.1/32            ident
    + host    all             all             127.0.0.1/32            md5
    # IPv6 local connections:
    - host    all             all             ::1/128                 ident
    + host    all             all             ::1/128                 md5
    ```
    {: file='/var/lib/pgsql/data/pg_hba.conf'}

13. Enable Postgres to start on OS boot
    ```bash
    systemctl enable postgresql
    ```

14. Restart Postgres
    ```bash
    systemctl restart postgresql
    ```

15. (Optional) Switch to the Postgres user
16. Create the database (use the same name of the old database)
    ```bash
    ### AS USER "POSTGRES"
    psql
    CREATE DATABASE db_name;

    ### AS ROOT
    sudo -i -u postgres bash -c "psql -c 'CREATE DATABASE db_name;'"
    ```

17. Create the database user (use the same username as the old database owner. You can skip this if the owner was the same as your postgres user)
    ```bash
    ### AS USER "POSTGRES"
    psql
    CREATE USER db_user WITH PASSWORD 'new_password';

    ### AS ROOT
    read -s -p "Enter Postgres user password: " db_pass
    sudo -i -u postgres bash -c "psql -c 'CREATE USER db_user WITH PASSWORD '$db_pass';"
    ```

    > To avoid an error that may occur when using special characters in the root version of the "CREATE USER" command above, it is recommended that the password be set with the "read" line before using it in the "CREATE USER" line. You can still use special characters in the password with the above command.
    >
    > What happens is the special characters are read in differently when writing the password directly within the command versus setting it in a variable then using said variable in the command. This will show up as an error when starting up the service that uses the database, mostly likely as an "incorrect password" error in the postgres log file.
    {: .prompt-info}

18. Grant the user permissions to database
    ```bash
    ### AS USER "POSTGRES"
    psql
    GRANT ALL PRIVILEGES ON DATABASE db_name TO db_user;

    ### AS ROOT
    sudo -i -u postgres bash -c "psql -c 'GRANT ALL PRIVILEGES ON DATABASE db_name TO db_user;'"
    ```

19. Import your `dump.sql` file into the database you created.
    ```bash
    ### AS USER "POSTGRES"
    psql -d db_name -f dump.sql

    ### AS ROOT
    sudo -i -u postgres bash -c "psql -d db_name -f dump.sql"
    ```

20. Reindex the database (this helps with performance, especially since this a "new" database that we just imported a bunch of data into).
    ```bash
    ### AS USER "POSTGRES"
    psql -d db_name -c "REINDEX DATABASE db_name;"

    ### AS ROOT
    sudo -i -u postgres psql -d db_name -c "REINDEX DATABASE db_name;"
    ```

21. Verify the service runs properly and that the data is present and readable.
22. Remove the `dump.sql` file.
    ```bash
    ### AS USER "POSTGRES"
    rm dump.sql

    ### AS ROOT
    sudo -i -u postgres bash -c "rm dump.sql"
    ```
