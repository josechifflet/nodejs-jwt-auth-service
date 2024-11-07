#!/usr/bin/env bash
# Set the region
region=us-west-2

# Ask user to prompt the AWS profile
read -p "Enter the AWS profile: " profile

# Prompt the name of the secret
read -p "Enter the name of the secret: " secret_name

# Set the dotenv file name
read -p "Enter the dotenv file name to get the secrets from: " dotenvfile

# Create an empty JSON object to store the key-value pairs
json='{}'

# Read the dotenv file and extract the key-value pairs
while read -r line; do
  # Skip comments and empty lines
  if [[ $line =~ ^# ]] || [[ -z $line ]]; then
    continue
  fi

  # Split the line into key and value
  IFS='=' read -r key value <<< "$line"
  # Remove leading and trailing whitespace from the key and value
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)

  # Add the key-value pair to the JSON object
  json=$(jq --arg key "$key" --arg value "$value" '. + {($key): $value}' <<< "$json")
done < "$dotenvfile"

# Put the JSON object in AWS Secrets Manager
aws secretsmanager create-secret --name "$secret_name" --secret-string "$json" --region "$region" --profile "$profile"