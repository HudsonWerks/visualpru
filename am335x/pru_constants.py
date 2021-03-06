#MEMORY RANGE
PRUSS_RANGE = (0x4A300000,0x4A37FFFF)

#SHARED MEMORY OFFSETS
PRU_SHAREDDRAM_OFFSET = 0x00010000 #Size: 12KB
PRU_OTHERDRAM_OFFSET = 0x00002000 #Size: 8KB. NOTE: This accessed the DRAM of the "other" PRU

#DEBUG OFFSETS/REGISTERS
GPREG_OFFSET = 0x00000000 #NOTE: All registers are 4 bytes wide
GPREG_COUNT = 32

#CONTROL OFFSETS/REGISTERS
CONTROL_OFFSET = 0x00000000
SOFT_RST_N_BIT = 0
ENABLE_BIT = 1
SLEEPING_BIT = 2
COUNTER_ENABLE_BIT = 3
SINGLE_STEP_BIT = 8
RUNSTATE_BIT = 15
PCOUNTER_RST_VAL_BIT = 16

STATUS_OFFSET = 0x00000004