import os
from app import app

#logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(msg)s")

COMPILATION_DIRECTORY= os.path.join(os.path.dirname(os.path.abspath(__file__)),'programs') #This constant determines where compilation output will be located

if __name__ == '__main__':

    #Start the app
    app.run(COMPILATION_DIRECTORY)