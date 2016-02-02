FROM nginx

RUN rm -rf /etc/nginx/conf.d
COPY config/nginx/nginx.conf /etc/nginx/nginx.conf
COPY config/nginx/conf.d /etc/nginx/conf.d
COPY dist /usr/share/nginx/html
