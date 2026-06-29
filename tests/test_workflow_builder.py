from monster_ai.modules.image.workflow_builder import build_txt2img_workflow


def test_build_workflow_without_lora():
    wf = build_txt2img_workflow(
        positive="cat",
        checkpoint="test.safetensors",
        width=512,
        height=512,
    )
    assert "10" not in wf
    assert wf["6"]["inputs"]["text"] == "cat"
    assert wf["4"]["inputs"]["ckpt_name"] == "test.safetensors"


def test_build_workflow_with_lora():
    wf = build_txt2img_workflow(
        positive="cat",
        checkpoint="test.safetensors",
        lora_name="style.safetensors",
    )
    assert wf["10"]["inputs"]["lora_name"] == "style.safetensors"
    assert wf["6"]["inputs"]["clip"] == ["10", 1]


def test_build_sdxl_workflow_for_cyberrealistic():
    wf = build_txt2img_workflow(
        positive="portrait",
        checkpoint="cyberrealistic_final.safetensors",
    )
    assert wf["5"]["inputs"]["width"] == 1024
    assert wf["5"]["inputs"]["height"] == 1024