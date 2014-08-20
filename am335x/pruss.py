from app.pru import PRU
import pru0_constants
import pru1_constants
import pru_constants

#List available PRUs for the chip
pru0 = None
pru1 = None

def get_hash():
    global pru0, pru1

    if pru0 is None:
        pru0 = PRU('pru0',pru0_constants,pru_constants)

    if pru1 is None:
        pru1 = PRU('pru1',pru1_constants,pru_constants)

    return {'pru0': pru0, 'pru1': pru1}

def unmap_memory():
    global pru0, pru1
    pru0.unmap_memory()
    pru1.unmap_memory()
