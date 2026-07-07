import marshal
import pathlib
import types


ROOT = pathlib.Path("extracted_pyinstaller/gerilim_dusumu_V-2.05")


def short(value, limit=220):
    text = repr(value)
    if len(text) > limit:
        return text[: limit - 3] + "..."
    return text


def walk(co, qualname="<module>", depth=0):
    indent = "  " * depth
    print(f"{indent}{qualname} line={co.co_firstlineno}")
    print(f"{indent}  names={co.co_names}")
    if co.co_varnames:
        print(f"{indent}  varnames={co.co_varnames}")
    if co.co_freevars:
        print(f"{indent}  freevars={co.co_freevars}")
    if co.co_cellvars:
        print(f"{indent}  cellvars={co.co_cellvars}")

    scalar_consts = []
    nested = []
    for c in co.co_consts:
        if isinstance(c, types.CodeType):
            nested.append(c)
        elif isinstance(c, (str, int, float, complex, tuple, frozenset, bytes, type(None), bool)):
            scalar_consts.append(c)
        else:
            scalar_consts.append(f"<{type(c).__name__}>")

    if scalar_consts:
        print(f"{indent}  consts:")
        for c in scalar_consts[:80]:
            print(f"{indent}    {short(c)}")
        if len(scalar_consts) > 80:
            print(f"{indent}    ... {len(scalar_consts) - 80} more")

    for child in nested:
        walk(child, f"{qualname}.{child.co_name}", depth + 1)


if __name__ == "__main__":
    code = marshal.loads(ROOT.read_bytes())
    walk(code)
