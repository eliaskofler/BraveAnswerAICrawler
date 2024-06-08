def remove_duplicates(input_file, output_file):
    # Open the input file and read all lines with UTF-8 encoding
    with open(input_file, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    # Use a set to remove duplicates
    unique_lines = set(lines)

    # Write the unique lines to the output file with UTF-8 encoding
    with open(output_file, 'w', encoding='utf-8') as file:
        file.writelines(unique_lines)

if __name__ == "__main__":
    # Specify the input and output file names
    input_file = 'squeries.txt'
    output_file = 'new_squeries.txt'

    # Call the function to remove duplicates
    remove_duplicates(input_file, output_file)