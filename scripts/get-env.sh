#!/usr/bin/env bash

# Check if jq is installed
if ! command -v jq > /dev/null; then
  # Install jq if it is not installed
  sudo apt-get install jq
fi

# Ask user to prompt the AWS profile
read -p "Enter the AWS profile: " profile

# Ask user to prompt the name of the secret as an argument to the script
read -p "Enter the name of the secret: " secret_name

# Ask user to prompt the name of the output file as an argument to the script
read -p "Enter the name of the output file: " output_file

# Download the secret value
secret_value=$(aws secretsmanager get-secret-value --secret-id $secret_name --query SecretString --output text --profile $profile)

echo "🟢 - Secret value downloaded"

# Parse the secret value to a file
echo "$secret_value" | jq -r 'to_entries[] | "\(.key)=\(.value)"' > $output_file

# Add custom key-value pairs to the file
echo "CUSTOM_KEY=custom_value" >> $output_file

# Set the permissions on the file to protect the sensitive information it contains
chmod 600 $output_file