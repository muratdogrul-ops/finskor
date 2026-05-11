-- Demo admin sifresini 1234 yap (mevcut kayitlar icin; 011 ile ayni hash)
UPDATE kullanicilar
SET sifre_hash = '$2a$12$vSOH0mX1LxfYAgJTdWfAkehh7I6IUTJMbGXgs.7TITircYrsxutgu'
WHERE LOWER(TRIM(email)) = LOWER(TRIM('info@finerp.tr'));
