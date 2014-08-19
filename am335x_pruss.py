from pru import PRU
import am335x_pru0_constants
import am335x_pru1_constants
import am335x_pru_constants

#List available PRUs for the chip
pru0 = None
pru1 = None

def get_hash():
    global pru0, pru1

    if pru0 is None:
        pru0 = PRU('pru0',am335x_pru0_constants,am335x_pru_constants)

    if pru1 is None:
        pru1 = PRU('pru1',am335x_pru1_constants,am335x_pru_constants)

    return {'pru0': pru0, 'pru1': pru1}

def unmap_memory():
    pru0.unmap_memory()
    pru1.unmap_memory()
