from bottle import Bottle, route, request, abort, run, template, static_file
import gevent
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.websocket import WebSocketError

import os
import json
import logging

import am335x_pruss as pruss #NOTE: For different chips, you can import modules which describe the PRU hardware. The hardware-specific configuration automatically propogates throughout the app(both backend and frontend)
import evt #GEvent loops

#Web app globals
app = Bottle()
APP_PATH = os.path.dirname(os.path.abspath(__file__))

#logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(msg)s")

@app.route('/')
def application():
    return static_file('html/visualpru.html', root=os.path.join(APP_PATH, 'static'))

@app.route('/static/<filename:path>')
def static(filename):
    return static_file(filename, root=os.path.join(APP_PATH, 'static'))

@app.route('/websocket')
def handle_websocket():
    wsock = request.environ.get('wsgi.websocket')
    if not wsock:
        abort(400, 'Expected WebSocket request.')

    #Start parallel event loops for monitoring the hardware and sending data
    monitor_prus_loop = gevent.spawn(evt.monitor_prus,prus)
    send_message_loop = gevent.spawn(evt.send_message,wsock)

    #Start the primary event loop for receiving commands from the front-end UI
    while True:
        try:
            print("Waiting to receive")
            m = wsock.receive()
            if m is not None:
                #NOTE: Every valid message sent will have a pruState hash and a type string
                message = json.loads(m)
                response = {}

                if message['action'] == "connect":
                    #On a connection, send a hash containing the PRUs
                    print("CONNECTION ESTABLISHED")

                    response['type'] = 'connection'
                    response['status'] = 'success'

                    response['availablePRUStates'] = {}
                    for k,v in prus.iteritems():
                      response['availablePRUStates'][k] = v.get_state()
                else:
                    pru = prus[message['pruState']['id']]
                    print(pru.id)

                    if message['action'] == "compile":
                        print("COMPILE")

                        pru.compile_and_upload_program(COMPILATION_DIRECTORY,message['pruState']['program']['sourceFiles'])

                    elif message['action'] == "run":
                        print("RUN")

                        pru.set_freerunning_mode()
                        pru.run()

                    elif message['action'] == "reset":
                        print("RESET")

                        pru.halt()
                        pru.reset()

                    elif message['action'] == "halt":
                        print("HALT")

                        pru.halt()
                        #pru.reset(pru.get_program_counter_value())
                        #print(pru.is_running())

                    elif message['action'] == "step":
                        print("STEP")
                        pru.set_singlestep_mode()
                        pru.run()

                    response['type'] = 'pruState'
                    response['pruState'] = pru.get_state()

                #Queue the response
                evt.queue.put(response)

        except Exception as e:
            #Since the closing of a websocket does not mean that the parent greenlet thread is ending, we need to kill the greenlets to avoid zombies
            monitor_prus_loop.kill()
            send_message_loop.kill()

            #Close the request, raise the error, and break out of the event loop
            raise e

if __name__ == '__main__':



    #Configuration Constants
    COMPILATION_DIRECTORY= os.path.join(APP_PATH,'programs') #This constant determines where programs will be start on the beagleBone relative to the app path

    #Create the PRU hardware access objects
    prus = pruss.get_hash()

    #Initialize and start the local webserver
    server = WSGIServer(('192.168.7.2', 3333), app,
                        handler_class=WebSocketHandler)
    try:
        server.serve_forever()
        print("SERVING FOREVER")
    finally:
        print("STOPPED SERVING FOREVER")
        #NOTE: Greenlets all run in the same thread, and therefore all are automatically killed when the app shuts down

        #Release physical memory mapped by the PRUs
        pruss.unmap_memory()
