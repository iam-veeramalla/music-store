require 'sinatra'
require 'json'
require 'securerandom'

set :bind, '0.0.0.0'
set :host_authorization, { permitted_hosts: [] }
set :port, ENV.fetch('PORT', 8085)

get '/healthz' do
  json_response(status: 'ok', service: 'payment-service')
end

post '/charge' do
  payload = JSON.parse(request.body.read) rescue {}
  amount = payload['amountCents'].to_i
  halt 400, json_response(error: 'amountCents required') if amount <= 0

  # simulate processing latency and occasional declines (nice for traces)
  sleep(rand(0.02..0.15))
  if rand < 0.05
    halt 402, json_response(status: 'declined', reason: 'card_declined')
  end

  json_response(
    status: 'approved',
    transactionId: "TXN-#{SecureRandom.hex(6).upcase}",
    amountCents: amount,
    currency: payload.fetch('currency', 'USD')
  )
end

def json_response(hash)
  content_type :json
  hash.to_json
end
