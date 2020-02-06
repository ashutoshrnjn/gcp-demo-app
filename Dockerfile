## Stage to build backend go code
FROM gcr.io/google-appengine/nodejs

WORKDIR /app

COPY . .

RUN npm install
RUN npm rebuild

# Copy local code to the container image.
EXPOSE 8080

ENV PORT=8080

# Run
CMD ["npm", "start"]