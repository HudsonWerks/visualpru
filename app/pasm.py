import subprocess
import re
import os

def compile(directory, filename):
    original_dir = os.getcwd()
    os.chdir(directory)

    temp = subprocess.check_output("pasm %s %s; exit 0" % ("-bl",filename),stderr=subprocess.STDOUT, shell=True)
    compilation_result = re.split("\n+",temp.strip())

    errors = []
    warnings = []
    for line in compilation_result:
        #TODO: Support filenames with multiple .'s
        match = re.search("(?P<filename>\w+\.?\w+)\((?P<lineno>\w+)\)\s+(?P<type>\w+):\s+(?P<string>.+)",line)
        if match:
            if match.group('type') == 'Error':
                errors.append({'filename' : match.group('filename'),'lineno' : match.group('lineno'),'text' : match.group('string')})
            elif match.group('type') == 'Warning':
                errors.append({'filename' : match.group('filename'),'lineno' : match.group('lineno'),'text' : match.group('string')})

    os.chdir(original_dir)

    return errors, warnings

def parse_compiler_output(directory, filename):
    original_dir = os.getcwd()
    os.chdir(directory)

    opcodes = []
    instructions = []
    with open(filename) as f:
        for line in f:
            #Split by the first two ":"'s only, so that we don't strip the ":" from the label
            temp = re.split("\s+:\s?",line.strip(),2) #line.strip().split(":",2)

            match = re.search("(?P<filename>\w+\.?\w+)\(\s*(?P<lineno>\w+)\)",temp[0])
            filename = match.group('filename')
            lineno = match.group('lineno')

            match = re.search("(?P<program_counter>\w+)\s*=\s*(?P<opcode>\w+)",temp[1])
            program_counter = int(match.group('program_counter'),16)
            opcode = match.group('opcode') #This could also contain labels

            #Add the actual opcodes to a list, ignoring all labels
            match = re.match("0x\w{8}",opcode)
            if match:
                opcodes.append(int(match.group(0),16))

            instruction = temp[2]#re.sub("\s+"," ",temp[2])

            instructions.append({'filename' : filename, 'programCounter': program_counter, 'text' : instruction })
            #TODO: Raise error if a mandatory match is not found. The file may be in the wrong format
            #TODO: Support filenames with multiple .'s

    os.chdir(original_dir)

    return opcodes, instructions