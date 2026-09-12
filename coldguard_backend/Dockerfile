FROM php:8.4-cli

# Install system dependencies & PostgreSQL driver
RUN apt-get update && apt-get install -y \
    libpq-dev \
    zip \
    unzip \
    git \
    curl \
    && docker-php-ext-install pdo pdo_pgsql

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy application code
COPY . /var/www/html

# Install dependencies
RUN composer install --no-dev --optimize-autoloader --ignore-platform-req=php+

# Expose port and start Laravel
EXPOSE 8000

CMD ["sh", "-c", "php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=${PORT:-8000}"]
