# MoldyMeat

Effortlessly keep your database's tables in sync with your Sequelize models.

Writing database migrations is a waste of time and effort, and even if you generate DB migrations, they're still something of a pain point.

```mermaid
sequenceDiagram
    actor Developer
    participant Sequelize
    participant MoldyMeat
    participant Database
    Developer->>Sequelize: Define models
    activate Developer
    Developer->>MoldyMeat: Run updates
    deactivate Developer
    activate MoldyMeat
    MoldyMeat->>Sequelize: Load defined models
    Sequelize->>MoldyMeat: 
    MoldyMeat->>MoldyMeat: Build state tree from models
    MoldyMeat->>Database: Load state tree after last update
    Database->>MoldyMeat: 
    MoldyMeat->>MoldyMeat: Diff previous and newly built state trees
    MoldyMeat->>Sequelize: Generate SQL to perform update
    Sequelize->>MoldyMeat: 
    MoldyMeat-xDatabase: Run update SQL
    deactivate MoldyMeat
```
