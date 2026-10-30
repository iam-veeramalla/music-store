FROM ruby:3.3-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY Gemfile .
RUN bundle install
COPY . .
EXPOSE 8085
CMD ["ruby","app.rb"]
