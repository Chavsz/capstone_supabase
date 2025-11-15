--check supabase if they have feature like uuid-ossp extension

CREATE DATABASE capstone_db;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--users table
CREATE TABLE users(
  user_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT NOW(),
  update_at TIMESTAMP DEFAULT NOW()
);

--Profile Tutor table
CREATE TABLE profile (
  profile_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  program VARCHAR(100),
  college VARCHAR(100),
  year_level VARCHAR(20),
  subject VARCHAR(100), --change name to subject
  specialization TEXT, --change name to specialization
  profile_image VARCHAR(255),
  nickname VARCHAR(100),
  online_link VARCHAR(255),
  file_link VARCHAR(100)
);

--Schedule table
CREATE TABLE schedule (
  schedule_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid REFERENCES profile(profile_id) ON DELETE CASCADE,
  day VARCHAR(20),
  start_time TIME,
  end_time TIME
);

--student profile table
CREATE TABLE student_profile (
  profile_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  program VARCHAR(100),
  college VARCHAR(100),
  year_level VARCHAR(20),
  profile_image VARCHAR(255)
);

--appointment table
CREATE TABLE appointment (
  appointment_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  tutor_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL, --specialization
  mode_of_session VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--notifcation table
CREATE TABLE notification (
  notification_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  notification_content VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--event table
CREATE TABLE event (
  event_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  event_title VARCHAR(255) NOT NULL,
  event_description TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  event_location VARCHAR(255) NOT NULL,
  event_image VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--landing table
CREATE TABLE landing (
  landing_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  
  home_image VARCHAR(255) NOT NULL,                       
  home_title VARCHAR(255) NOT NULL,                        
  home_description TEXT NOT NULL,                         
  home_more VARCHAR(255) NOT NULL,                        
  about_image VARCHAR(255) NOT NULL,                    
  about_title VARCHAR(255) NOT NULL,                       
  about_description TEXT NOT NULL,                       
  about_link VARCHAR(255) NOT NULL,                        
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,         
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP          
);

--announcement table
  CREATE TABLE announcement ( 
  announcement_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  announcement_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--data stored
INSERT INTO users (user_name, user_email, user_password, user_role) VALUES ('Chavyst', 'chavyst@gmail.com', '123456', 'student'); --role = tutee
INSERT INTO users (user_name, user_email, user_password, user_role) VALUES ('Chavy', 'chavy@gmail.com', 'chavy123', 'tutor'); --role = tutor
INSERT INTO users (user_name, user_email, user_password, user_role) VALUES ('ChavyAdmin', 'admin@gmail.com', 'admin123', 'admin'); --role = admin

--queries
SELECT * FROM users;
UPDATE users SET user_role = 'admin' WHERE name = 'Chavy';

--tutor datas

--programming
josh@gmail.com
max@gmail.com
chris@gmail.com
may@gmail.com
--chemistry
curie@gmail.com
martin@gmail.com
jes@gmail.com
--physics
tel@gmail.com
robert@gmail.com
--calculus
justine@gmail.com
diane@gmail.com
john@gmail.com
ghost@gmail.com

--check database size
SELECT pg_size_pretty(pg_database_size('capstone_db'));



