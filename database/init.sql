CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR (255) NOT NULL,
    password VARCHAR (255) NOT NULL,
    email VARCHAR (255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gravatar VARCHAR (255),
);

CREATE TABLE file (
    id SERIAL PRIMARY KEY,
    title VARCHAR (255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR (255),
    people_access INTEGER[]  
    
)

alter table file add column transcript TEXT 
alter table file add column date_created VARCHAR (8) DEFAULT TO_CHAR(CURRENT_DATE, 'DD/MM/YY')
alter table file add column duration TEXT 

CREATE TABLE folder (
    id SERIAL PRIMARY KEY,
    title VARCHAR (255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date_created VARCHAR (8) DEFAULT TO_CHAR(CURRENT_DATE, 'DD/MM/YY')
    
)

alter table file add column folder_id INTEGER REFERENCES folder(id) ON DELETE CASCADE
--comentario

ALTER TABLE public.file ALTER COLUMN file_path TYPE text USING file_path::text;

CREATE TABLE folder (
    id SERIAL PRIMARY KEY,
    title VARCHAR (255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date_created VARCHAR (8) DEFAULT TO_CHAR(CURRENT_DATE, 'DD/MM/YY')
    
)

CREATE TABLE contact (
    id serial PRIMARY KEY,
    owner_id integer REFERENCES users(id),
    contact_id integer REFERENCES users(id)
    
)

